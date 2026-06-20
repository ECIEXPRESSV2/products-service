import { Inject, Injectable, Logger } from '@nestjs/common';
import { CART_REPOSITORY } from '../repositories/cart.repository';
import type { ICartRepository } from '../repositories/cart.repository';
import { SharedEventPublisher } from '../../../messaging/shared-bus/shared-event-publisher.service';
import {
  CartItemInput,
  PUBLISHED_PRODUCT_EVENTS,
  ReturnPricedLine,
  ReturnPricedPayload,
} from '../../../messaging/shared-bus/contracts';

/**
 * Cotiza devoluciones (totales o parciales) usando la proyección del carrito como
 * fuente de los precios autoritativos. Orders solo indica QUÉ devolver (productIds y
 * cantidades, o "completa"); aquí se calcula CUÁNTO reembolsar y se publica
 * `products.return.priced` para que financial-service acredite la billetera.
 */
@Injectable()
export class ReturnsPricingService {
  private readonly logger = new Logger(ReturnsPricingService.name);

  constructor(
    @Inject(CART_REPOSITORY) private readonly carts: ICartRepository,
    private readonly publisher: SharedEventPublisher,
  ) {}

  async priceReturn(params: {
    orderId: string;
    storeId: string;
    full: boolean;
    items?: CartItemInput[];
  }): Promise<ReturnPricedPayload | null> {
    const cart = await this.carts.findById(params.orderId);
    if (!cart) {
      this.logger.warn(
        `Devolución para carrito inexistente ${params.orderId}; ignorada`,
      );
      return null;
    }

    const lines: ReturnPricedLine[] = [];
    let refundAmount = 0;

    if (params.full || !params.items?.length) {
      // Devolución total: se reembolsa el total final del carrito.
      for (const line of cart.lines) {
        lines.push({ productId: line.productId, quantity: line.quantity, amount: line.totalAmount });
        refundAmount += line.totalAmount;
      }
    } else {
      // Devolución parcial: solo los productos seleccionados, acotando la cantidad
      // a lo que realmente había en el carrito y usando su precio unitario efectivo.
      const byProduct = new Map(cart.lines.map((line) => [line.productId, line]));
      for (const item of params.items) {
        const line = byProduct.get(item.productId);
        if (!line) {
          this.logger.warn(
            `Producto ${item.productId} no está en el carrito ${params.orderId}; omitido de la devolución`,
          );
          continue;
        }
        const quantity = Math.min(Math.max(item.quantity, 0), line.quantity);
        if (quantity === 0) continue;
        const amount = line.unitPrice * quantity;
        lines.push({ productId: line.productId, quantity, amount });
        refundAmount += amount;
      }
    }

    const payload: ReturnPricedPayload = {
      orderId: params.orderId,
      storeId: cart.storeId,
      full: params.full || !params.items?.length,
      refundAmount,
      lines,
    };

    await this.publisher.publish(PUBLISHED_PRODUCT_EVENTS.RETURN_PRICED, {
      ...payload,
    } as unknown as Record<string, unknown>);
    this.logger.log(
      `Devolución cotizada para ${params.orderId}: ${refundAmount} centavos (${lines.length} líneas)`,
    );
    return payload;
  }
}
