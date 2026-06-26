import { Injectable } from '@nestjs/common';
import {
  CATEGORY_EVENTS,
  CategoryCreatedPayload,
  CategoryDeletedPayload,
  CategoryUpdatedPayload,
} from '../events/category.events';
import { SharedEventPublisher } from '../shared-bus/shared-event-publisher.service';

/**
 * Publica los eventos de catálogo de categorías. Antes iban a la cola directa
 * `products_events` (NestJS Transport.RMQ); ahora viajan por el exchange topic
 * compartido `eciexpress_events`, igual que el resto de eventos de products.
 * La API pública no cambió: solo cambió el transporte al bus compartido.
 */
@Injectable()
export class CategoryPublisher {
  constructor(private readonly bus: SharedEventPublisher) {}

  categoryCreated(payload: CategoryCreatedPayload): void {
    void this.bus.publish(CATEGORY_EVENTS.CREATED, payload);
  }

  categoryUpdated(payload: CategoryUpdatedPayload): void {
    void this.bus.publish(CATEGORY_EVENTS.UPDATED, payload);
  }

  categoryDeleted(payload: CategoryDeletedPayload): void {
    void this.bus.publish(CATEGORY_EVENTS.DELETED, payload);
  }
}
