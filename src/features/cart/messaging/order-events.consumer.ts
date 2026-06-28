import { Injectable, Logger } from '@nestjs/common';
import {
  CONSUMED_ORDER_EVENTS,
  type CartCreatedPayload,
  type CartItemChangedPayload,
  type OrderCancelledPayload,
  type ReturnRequestedPayload,
} from '../../../messaging/shared-bus/contracts';
import { CartPricingService } from '../services/cart-pricing.service';
import { ReturnsPricingService } from '../services/returns-pricing.service';
import { StockReservationService } from '../services/stock-reservation.service';

/**
 * Despacha los eventos `order.*` (carrito/devolución de orders-service) a los servicios
 * de dominio. Lo invoca el ServiceBusSubscriberService con el routing-key (Subject del
 * mensaje) y el body ya deserializado. Solo reacciona a las routing keys que nos
 * interesan; el resto se ignora silenciosamente.
 */
@Injectable()
export class OrderEventsConsumer {
  private readonly logger = new Logger(OrderEventsConsumer.name);

  constructor(
    private readonly cartPricing: CartPricingService,
    private readonly returnsPricing: ReturnsPricingService,
    private readonly stock: StockReservationService,
  ) {}

  async handle(
    routingKey: string,
    payload: Record<string, any>,
  ): Promise<void> {
    try {
      switch (routingKey) {
        case CONSUMED_ORDER_EVENTS.CART_CREATED: {
          const p = payload as CartCreatedPayload;
          await this.cartPricing.createCart(p.cartId, p.storeId, p.currency ?? 'COP');
          break;
        }
        case CONSUMED_ORDER_EVENTS.CART_ITEM_CHANGED: {
          const p = payload as CartItemChangedPayload;
          await this.cartPricing.priceCart(p.cartId, p.storeId, p.items ?? [], p.currency ?? 'COP');
          break;
        }
        case CONSUMED_ORDER_EVENTS.RETURN_REQUESTED: {
          const p = payload as ReturnRequestedPayload;
          await this.returnsPricing.priceReturn({
            orderId: p.orderId,
            storeId: p.storeId,
            full: p.full,
            items: p.items,
          });
          break;
        }
        case CONSUMED_ORDER_EVENTS.ORDER_CREATED: {
          await this.stock.reserveForOrder((payload as { orderId: string }).orderId);
          break;
        }
        case CONSUMED_ORDER_EVENTS.ORDER_CONFIRMED: {
          await this.stock.confirmForOrder((payload as { orderId: string }).orderId);
          break;
        }
        case CONSUMED_ORDER_EVENTS.ORDER_CANCELLED: {
          const p = payload as OrderCancelledPayload;
          await this.stock.releaseForOrder(p.orderId, p.wasSold ?? false);
          break;
        }
        default:
          this.logger.debug(`Routing key ignorada: ${routingKey}`);
      }
    } catch (error) {
      // Se loguea y se deja terminar (ack) para no reencolar indefinidamente; los
      // servicios son idempotentes (la cotización reemplaza el estado completo).
      this.logger.error(
        `Error procesando ${routingKey}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
