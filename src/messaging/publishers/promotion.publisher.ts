import { Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import {
  PROMOTION_EVENTS,
  PromotionCreatedPayload,
  PromotionDeletedPayload,
  PromotionUpdatedPayload,
} from '../events/promotion.events';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';

@Injectable()
export class PromotionPublisher {
  constructor(
    @Inject(RABBITMQ_CLIENT)
    private readonly client: ClientProxy,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  promotionCreated(payload: PromotionCreatedPayload): void {
    this.emit(PROMOTION_EVENTS.CREATED, payload);
  }

  promotionUpdated(payload: PromotionUpdatedPayload): void {
    this.emit(PROMOTION_EVENTS.UPDATED, payload);
  }

  promotionDeleted(payload: PromotionDeletedPayload): void {
    this.emit(PROMOTION_EVENTS.DELETED, payload);
  }

  private emit(pattern: string, payload: unknown): void {
    try {
      this.client.emit(pattern, payload);
    } catch (error) {
      this.logger.error(`Failed to emit event ${pattern}`, error, PromotionPublisher.name);
    }
  }
}
