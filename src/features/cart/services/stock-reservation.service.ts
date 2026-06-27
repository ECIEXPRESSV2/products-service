import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRODUCT_SERVICE } from '../../products/services/product.service.interface';
import type { IProductService } from '../../products/services/product.service.interface';
import { CART_REPOSITORY } from '../repositories/cart.repository';
import type { ICartRepository } from '../repositories/cart.repository';
import { SharedEventPublisher } from '../../../messaging/shared-bus/shared-event-publisher.service';
import { PUBLISHED_PRODUCT_EVENTS } from '../../../messaging/shared-bus/contracts';

/**
 * Reserva de inventario cableada al flujo nuevo. orders no envía los ítems en los
 * eventos de orden, así que tomamos las líneas de la PROYECCIÓN del carrito
 * (`cart_lines`, keyed por cartId = orderId) que ya mantenemos como autoridad de
 * precios. Best-effort: si una línea falla, se loguea y se continúa (el cobro ya
 * ocurrió en checkout; el inventario se reconcilia aparte).
 */
@Injectable()
export class StockReservationService {
  private readonly logger = new Logger(StockReservationService.name);

  constructor(
    @Inject(CART_REPOSITORY) private readonly carts: ICartRepository,
    @Inject(PRODUCT_SERVICE) private readonly products: IProductService,
    private readonly sharedEventPublisher: SharedEventPublisher,
  ) {}

  /** Checkout (order.order.created): reserva stock de cada línea del carrito. */
  async reserveForOrder(orderId: string): Promise<void> {
    await this.forEachLine(orderId, 'reservar', {
      filterReserved: false, // todavía no hay nada reservado: se intenta con todas las líneas
      fn: async (productId, quantity) => {
        await this.products.reserveStock(productId, quantity, orderId);
        // Solo se marca tras éxito: si esta línea falla, releaseForOrder/restoreForOrder
        // no deben tocarla luego (no hay nada que liberar/restituir — ver CartLine.stockReserved).
        await this.carts.markLineReserved(orderId, productId, true);
      },
      onRejected: (productId, quantity, reason) =>
        this.publishReservationRejected(orderId, productId, quantity, reason),
    });
  }

  /** Confirmación (order.order.confirmed): consume (descuenta) la reserva. */
  async confirmForOrder(orderId: string): Promise<void> {
    await this.forEachLine(orderId, 'confirmar', {
      filterReserved: true, // solo lo que de verdad se reservó puede confirmarse como venta
      fn: (productId, quantity) => this.products.confirmReservation(productId, quantity, orderId),
    });
  }

  /**
   * Cancelación (order.order.cancelled). Si la orden nunca llegó a confirmarse,
   * solo libera la reserva (`reservedStock -= qty`, `stock` no se tocó). Si ya
   * había sido CONFIRMED, `confirmReservation` ya descontó `stock` (venta
   * concretada) y dejó `reservedStock` en 0 — hay que restituir `stock` en su lugar.
   * `filterReserved: true` en ambos casos: una línea cuya reserva nunca se aplicó
   * (porque falló o nunca se intentó) no debe restar del contador GLOBAL de
   * `reservedStock` del producto — eso le robaría stock a otra orden que sí reservó.
   */
  async releaseForOrder(orderId: string, wasSold: boolean): Promise<void> {
    await this.forEachLine(orderId, wasSold ? 'restituir' : 'liberar', {
      filterReserved: true,
      fn: (productId, quantity) =>
        wasSold
          ? this.products.restoreStock(productId, quantity, orderId)
          : this.products.releaseStock(productId, quantity, orderId),
    });
  }

  private async forEachLine(
    orderId: string,
    action: string,
    opts: {
      filterReserved: boolean;
      fn: (productId: string, quantity: number) => Promise<void>;
      onRejected?: (productId: string, quantity: number, reason: string) => Promise<void>;
    },
  ): Promise<void> {
    const cart = await this.carts.findById(orderId);
    if (!cart || cart.lines.length === 0) {
      this.logger.debug(`Sin proyección de carrito para ${orderId}; no hay stock que ${action}.`);
      return;
    }
    const lines = opts.filterReserved ? cart.lines.filter((line) => line.stockReserved) : cart.lines;
    for (const line of lines) {
      try {
        await opts.fn(line.productId, line.quantity);
      } catch (error) {
        const reason = (error as Error).message;
        this.logger.error(
          `No se pudo ${action} stock producto=${line.productId} order=${orderId}: ${reason}`,
        );
        if (opts.onRejected) {
          await opts.onRejected(line.productId, line.quantity, reason);
        }
      }
    }
  }

  /** CU-05: publica el rechazo de una línea para que orders pueda reaccionar (cancelar/notificar). */
  private async publishReservationRejected(
    orderId: string,
    productId: string,
    quantity: number,
    reason: string,
  ): Promise<void> {
    const product = await this.products.findById(productId).catch(() => null);
    const storeId = product?.storeId ?? '';
    const available = product ? product.stock - product.reservedStock : 0;
    await this.sharedEventPublisher.publish(PUBLISHED_PRODUCT_EVENTS.RESERVATION_REJECTED, {
      orderId,
      productId,
      storeId,
      requestedQuantity: quantity,
      availableQuantity: available,
      reason,
    });
  }
}
