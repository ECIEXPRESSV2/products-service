import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRODUCT_SERVICE } from '../../products/services/product.service.interface';
import type { IProductService } from '../../products/services/product.service.interface';
import { CART_REPOSITORY } from '../repositories/cart.repository';
import type { ICartRepository } from '../repositories/cart.repository';
import { Cart } from '../entities/cart.entity';
import { SharedEventPublisher } from '../../../messaging/shared-bus/shared-event-publisher.service';
import { PUBLISHED_PRODUCT_EVENTS } from '../../../messaging/shared-bus/contracts';

/**
 * Reintentos de espera de la proyección del carrito. order.cart.item_changed (que la
 * puebla) y order.order.created (que reserva) viajan por el bus compartido sin garantía
 * de orden estricto: order.order.created puede llegar ANTES de que la proyección exista.
 * En vez de saltar la reserva en silencio (lo que dejaría stock sin reservar y permitiría
 * sobreventa), esperamos brevemente a que aparezca. Configurable por si el pricing tarda.
 */
const CART_READY_MAX_ATTEMPTS = Number(process.env.CART_READY_MAX_ATTEMPTS ?? 10);
const CART_READY_DELAY_MS = Number(process.env.CART_READY_DELAY_MS ?? 300);

/**
 * Reserva de inventario cableada al flujo nuevo. orders no envía los ítems en los
 * eventos de orden, así que tomamos las líneas de la PROYECCIÓN del carrito
 * (`cart_lines`, keyed por cartId = orderId) que ya mantenemos como autoridad de
 * precios.
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
    // Option A: espera a que la proyección del carrito tenga líneas antes de reservar.
    const cart = await this.waitForCart(orderId, (c) => c.lines.length > 0);
    if (!cart) {
      this.logger.error(
        `No apareció la proyección del carrito para ${orderId} tras ${CART_READY_MAX_ATTEMPTS} intentos; ` +
          'no se pudo reservar stock.',
      );
      return;
    }

    let reservedCount = 0;
    let anyRejected = false;
    for (const line of cart.lines) {
      // Idempotencia ante entrega duplicada de order.created (bus at-least-once): si la
      // línea YA fue reservada, no la reservamos otra vez. Sin esto, una reentrega
      // duplicaría `reserved_stock` o —si el stock ya se agotó entre ambas entregas—
      // emitiría un `reservation_rejected` espurio para un pedido ya reservado, dejándolo
      // en un estado contradictorio (reservado + rechazado) que corrompe el inventario.
      if (line.stockReserved) {
        reservedCount += 1;
        continue;
      }
      try {
        await this.products.reserveStock(line.productId, line.quantity, orderId);
        // Solo se marca tras éxito: si esta línea falla, releaseForOrder no debe tocarla
        // luego (no hay nada que liberar/restituir — ver CartLine.stockReserved).
        await this.carts.markLineReserved(orderId, line.productId, true);
        reservedCount += 1;
      } catch (error) {
        anyRejected = true;
        const reason = (error as Error).message;
        this.logger.error(
          `No se pudo reservar stock producto=${line.productId} order=${orderId}: ${reason}`,
        );
        // CU-05: avisa a orders para que cancele/notifique.
        await this.publishReservationRejected(orderId, line.productId, line.quantity, reason);
      }
    }

    // Option C: solo si TODAS las líneas se reservaron avisamos que la orden puede
    // confirmarse. Si alguna se rechazó, ya publicamos reservation_rejected y orders
    // cancelará el pedido completo; no confirmamos una reserva parcial.
    if (!anyRejected && reservedCount > 0) {
      await this.sharedEventPublisher.publish(PUBLISHED_PRODUCT_EVENTS.RESERVATION_CONFIRMED, {
        orderId,
        storeId: cart.storeId,
      });
    }
  }

  /** Confirmación (order.order.confirmed): consume (descuenta) la reserva. */
  async confirmForOrder(orderId: string): Promise<void> {
    // Con Option C, order.order.confirmed sólo llega tras reservation_confirmed, así que
    // las líneas ya deberían estar marcadas como reservadas. Esperamos de forma defensiva
    // por si el bus reordenó los mensajes respecto a markLineReserved.
    const cart = await this.waitForCart(orderId, (c) => c.lines.some((line) => line.stockReserved));
    if (!cart) {
      this.logger.error(
        `Sin líneas reservadas para confirmar order=${orderId} tras ${CART_READY_MAX_ATTEMPTS} intentos; ` +
          'no se descontó stock.',
      );
      return;
    }
    for (const line of cart.lines.filter((line) => line.stockReserved)) {
      try {
        await this.products.confirmReservation(line.productId, line.quantity, orderId);
      } catch (error) {
        this.logger.error(
          `No se pudo confirmar stock producto=${line.productId} order=${orderId}: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Cancelación (order.order.cancelled). Si la orden nunca llegó a confirmarse, solo
   * libera la reserva (`reservedStock -= qty`, `stock` no se tocó). Si ya había sido
   * CONFIRMED, `confirmReservation` ya descontó `stock` (venta concretada) y dejó
   * `reservedStock` en 0 — hay que restituir `stock` en su lugar. En ambos casos solo se
   * tocan las líneas cuya reserva SÍ se aplicó (`stockReserved`): una línea cuya reserva
   * nunca se aplicó no debe restar del contador GLOBAL de `reservedStock` del producto —
   * eso le robaría stock a otra orden que sí reservó.
   */
  async releaseForOrder(orderId: string, wasSold: boolean): Promise<void> {
    const cart = await this.carts.findById(orderId);
    if (!cart || cart.lines.length === 0) {
      this.logger.debug(`Sin proyección de carrito para ${orderId}; no hay stock que liberar.`);
      return;
    }
    const action = wasSold ? 'restituir' : 'liberar';
    for (const line of cart.lines.filter((line) => line.stockReserved)) {
      try {
        if (wasSold) {
          await this.products.restoreStock(line.productId, line.quantity, orderId);
        } else {
          await this.products.releaseStock(line.productId, line.quantity, orderId);
        }
        // Idempotencia ante entrega duplicada de order.cancelled (bus at-least-once):
        // marca la línea como NO reservada tras liberar/restituir. `restoreStock`/
        // `releaseStock` no son idempotentes (`stock += qty`), así que sin esto un segundo
        // order.cancelled restituiría el stock OTRA VEZ (el bug de "el stock queda el doble"
        // al cancelar). Con la línea ya en false, el segundo evento no toca el inventario.
        await this.carts.markLineReserved(orderId, line.productId, false);
      } catch (error) {
        this.logger.error(
          `No se pudo ${action} stock producto=${line.productId} order=${orderId}: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Espera (con reintentos y backoff fijo) a que la proyección del carrito exista y
   * cumpla `ready`. Devuelve el carrito ya listo, o `null` si se agotaron los intentos.
   */
  private async waitForCart(orderId: string, ready: (cart: Cart) => boolean): Promise<Cart | null> {
    for (let attempt = 1; attempt <= CART_READY_MAX_ATTEMPTS; attempt += 1) {
      const cart = await this.carts.findById(orderId);
      if (cart && ready(cart)) return cart;
      if (attempt < CART_READY_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, CART_READY_DELAY_MS));
      }
    }
    return null;
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
