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
    await this.forEachLine(
      orderId,
      'reservar',
      (productId, quantity) => this.products.reserveStock(productId, quantity, orderId),
      (productId, quantity, reason) =>
        this.publishReservationRejected(orderId, productId, quantity, reason),
    );
  }

  /** Confirmación (order.order.confirmed): consume (descuenta) la reserva. */
  async confirmForOrder(orderId: string): Promise<void> {
    await this.forEachLine(orderId, 'confirmar', (productId, quantity) =>
      this.products.confirmReservation(productId, quantity, orderId),
    );
  }

  /** Cancelación (order.order.cancelled): libera la reserva. */
  async releaseForOrder(orderId: string): Promise<void> {
    await this.forEachLine(orderId, 'liberar', (productId, quantity) =>
      this.products.releaseStock(productId, quantity, orderId),
    );
  }

  private async forEachLine(
    orderId: string,
    action: string,
    fn: (productId: string, quantity: number) => Promise<void>,
    onRejected?: (productId: string, quantity: number, reason: string) => Promise<void>,
  ): Promise<void> {
    const cart = await this.carts.findById(orderId);
    if (!cart || cart.lines.length === 0) {
      this.logger.debug(`Sin proyección de carrito para ${orderId}; no hay stock que ${action}.`);
      return;
    }
    for (const line of cart.lines) {
      try {
        await fn(line.productId, line.quantity);
      } catch (error) {
        const reason = (error as Error).message;
        this.logger.error(
          `No se pudo ${action} stock producto=${line.productId} order=${orderId}: ${reason}`,
        );
        if (onRejected) {
          await onRejected(line.productId, line.quantity, reason);
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
