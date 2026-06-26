import { Injectable } from '@nestjs/common';
import {
  PRODUCT_EVENTS,
  ProductCreatedPayload,
  ProductDeletedPayload,
  ProductUpdatedPayload,
} from '../events/product.events';
import { SharedEventPublisher } from '../shared-bus/shared-event-publisher.service';

/**
 * Publica los eventos de catálogo de productos en el exchange topic compartido
 * `eciexpress_events` (antes iban a la cola directa `products_events` vía Transport.RMQ).
 * La API pública no cambió: solo cambió el transporte al bus compartido.
 */
@Injectable()
export class ProductPublisher {
  constructor(private readonly bus: SharedEventPublisher) {}

  productCreated(payload: ProductCreatedPayload): void {
    void this.bus.publish(PRODUCT_EVENTS.CREATED, payload);
  }

  productUpdated(payload: ProductUpdatedPayload): void {
    void this.bus.publish(PRODUCT_EVENTS.UPDATED, payload);
  }

  productDeleted(payload: ProductDeletedPayload): void {
    void this.bus.publish(PRODUCT_EVENTS.DELETED, payload);
  }
}
