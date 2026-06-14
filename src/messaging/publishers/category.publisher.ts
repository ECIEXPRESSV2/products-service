import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CATEGORY_EVENTS,
  CategoryCreatedPayload,
  CategoryDeletedPayload,
  CategoryUpdatedPayload,
} from '../events/category.events';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';

@Injectable()
export class CategoryPublisher {
  private readonly logger = new Logger(CategoryPublisher.name);

  constructor(@Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  emit(event: string, payload: unknown): void {
    this.client.emit(event, payload).subscribe({
      error: (err: unknown) => this.logger.error(`Failed to emit "${event}"`, err),
    });
  }

  categoryCreated(payload: CategoryCreatedPayload): void {
    this.emit(CATEGORY_EVENTS.CREATED, payload);
  }

  categoryUpdated(payload: CategoryUpdatedPayload): void {
    this.emit(CATEGORY_EVENTS.UPDATED, payload);
  }

  categoryDeleted(payload: CategoryDeletedPayload): void {
    this.emit(CATEGORY_EVENTS.DELETED, payload);
  }
}
