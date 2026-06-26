import { Injectable } from '@nestjs/common';
import {
  PROMOTION_EVENTS,
  PromotionCreatedPayload,
  PromotionDeletedPayload,
  PromotionUpdatedPayload,
} from '../events/promotion.events';
import { SharedEventPublisher } from '../shared-bus/shared-event-publisher.service';

/**
 * Publica los eventos de catálogo de promociones en el exchange topic compartido
 * `eciexpress_events` (antes iban a la cola directa `products_events` vía Transport.RMQ).
 * La API pública no cambió: solo cambió el transporte al bus compartido.
 */
@Injectable()
export class PromotionPublisher {
  constructor(private readonly bus: SharedEventPublisher) {}

  promotionCreated(payload: PromotionCreatedPayload): void {
    void this.bus.publish(PROMOTION_EVENTS.CREATED, payload);
  }

  promotionUpdated(payload: PromotionUpdatedPayload): void {
    void this.bus.publish(PROMOTION_EVENTS.UPDATED, payload);
  }

  promotionDeleted(payload: PromotionDeletedPayload): void {
    void this.bus.publish(PROMOTION_EVENTS.DELETED, payload);
  }
}
