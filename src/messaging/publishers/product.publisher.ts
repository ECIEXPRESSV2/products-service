import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  PRODUCT_EVENTS,
  ProductCreatedPayload,
  ProductDeletedPayload,
  ProductUpdatedPayload,
} from '../events/product.events';
import { RABBITMQ_CLIENT } from './category.publisher';

@Injectable()
export class ProductPublisher {
  private readonly logger = new Logger(ProductPublisher.name);

  constructor(@Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  emit(event: string, payload: unknown): void {
    this.client.emit(event, payload).subscribe({
      error: (err: unknown) => this.logger.error(`Failed to emit "${event}"`, err),
    });
  }

  productCreated(payload: ProductCreatedPayload): void {
    this.emit(PRODUCT_EVENTS.CREATED, payload);
  }

  productUpdated(payload: ProductUpdatedPayload): void {
    this.emit(PRODUCT_EVENTS.UPDATED, payload);
  }

  productDeleted(payload: ProductDeletedPayload): void {
    this.emit(PRODUCT_EVENTS.DELETED, payload);
  }
}
