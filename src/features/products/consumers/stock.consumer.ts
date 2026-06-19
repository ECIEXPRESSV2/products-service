import { Controller, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { IProductService } from '../services/product.service.interface';
import { PRODUCT_SERVICE } from '../services/product.service.interface';
import {
  ORDER_EVENTS,
  type OrderCancelledPayload,
  type OrderConfirmedPayload,
  type OrderPlacedPayload,
} from '../../../messaging/events/order.events';

@Controller()
export class StockConsumer {
  constructor(
    @Inject(PRODUCT_SERVICE)
    private readonly productService: IProductService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  @EventPattern(ORDER_EVENTS.PLACED)
  async handleOrderPlaced(@Payload() payload: OrderPlacedPayload): Promise<void> {
    this.logger.log(`Reserving stock for order=${payload.orderId}`, StockConsumer.name);
    const reserved: Array<{ productId: string; quantity: number }> = [];

    for (const item of payload.items) {
      try {
        await this.productService.reserveStock(item.productId, item.quantity, payload.orderId);
        reserved.push(item);
      } catch (error) {
        this.logger.error(
          `Failed to reserve stock product=${item.productId} order=${payload.orderId}`,
          error,
          StockConsumer.name,
        );
        // Rollback de reservas ya exitosas
        for (const done of reserved) {
          try {
            await this.productService.releaseStock(done.productId, done.quantity, payload.orderId);
          } catch (rollbackError) {
            this.logger.error(
              `Rollback failed for product=${done.productId} order=${payload.orderId}`,
              rollbackError,
              StockConsumer.name,
            );
          }
        }
        return;
      }
    }
  }

  @EventPattern(ORDER_EVENTS.CONFIRMED)
  async handleOrderConfirmed(@Payload() payload: OrderConfirmedPayload): Promise<void> {
    this.logger.log(`Confirming stock reservation for order=${payload.orderId}`, StockConsumer.name);
    for (const item of payload.items) {
      try {
        await this.productService.confirmReservation(item.productId, item.quantity, payload.orderId);
      } catch (error) {
        this.logger.error(
          `Failed to confirm reservation product=${item.productId} order=${payload.orderId}`,
          error,
          StockConsumer.name,
        );
      }
    }
  }

  @EventPattern(ORDER_EVENTS.CANCELLED)
  async handleOrderCancelled(@Payload() payload: OrderCancelledPayload): Promise<void> {
    this.logger.log(`Releasing stock for cancelled order=${payload.orderId}`, StockConsumer.name);
    for (const item of payload.items) {
      try {
        await this.productService.releaseStock(item.productId, item.quantity, payload.orderId);
      } catch (error) {
        this.logger.error(
          `Failed to release stock product=${item.productId} order=${payload.orderId}`,
          error,
          StockConsumer.name,
        );
      }
    }
  }
}
