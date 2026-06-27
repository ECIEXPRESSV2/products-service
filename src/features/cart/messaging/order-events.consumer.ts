import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { ConsumeMessage } from 'amqplib';
import { SHARED_EXCHANGE_NAME, SHARED_QUEUE_NAME } from '../../../messaging/shared-bus/shared-bus.config';
import {
  CONSUMED_ORDER_EVENTS,
  ORDER_BINDING_PATTERN,
  type CartCreatedPayload,
  type CartItemChangedPayload,
  type OrderCancelledPayload,
  type ReturnRequestedPayload,
} from '../../../messaging/shared-bus/contracts';
import { CartPricingService } from '../services/cart-pricing.service';
import { ReturnsPricingService } from '../services/returns-pricing.service';
import { StockReservationService } from '../services/stock-reservation.service';

/**
 * Enlaza la cola propia `products_service_queue` al exchange compartido con el patrón
 * `order.#` y despacha los eventos de carrito/devolución de orders-service a los
 * servicios de dominio. Solo reacciona a las routing keys que nos interesan; el resto
 * (que llega por el comodín) se ignora silenciosamente.
 */
@Injectable()
export class OrderEventsConsumer {
  private readonly logger = new Logger(OrderEventsConsumer.name);

  constructor(
    private readonly cartPricing: CartPricingService,
    private readonly returnsPricing: ReturnsPricingService,
    private readonly stock: StockReservationService,
  ) {}

  @RabbitSubscribe({
    exchange: SHARED_EXCHANGE_NAME,
    routingKey: ORDER_BINDING_PATTERN,
    queue: SHARED_QUEUE_NAME,
    queueOptions: { durable: true },
    createQueueIfNotExists: true,
  })
  async handle(payload: unknown, amqpMsg: ConsumeMessage): Promise<void> {
    const routingKey = amqpMsg.fields.routingKey;
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
