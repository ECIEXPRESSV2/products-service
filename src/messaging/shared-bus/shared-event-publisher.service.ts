import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { SHARED_EXCHANGE_NAME } from './shared-bus.config';

/**
 * Publica eventos de products-service sobre el exchange topic compartido
 * `eciexpress_events`. Añade `occurredAt` y `source` al payload, en línea con el
 * envelope que usan los demás servicios.
 */
@Injectable()
export class SharedEventPublisher {
  private readonly logger = new Logger(SharedEventPublisher.name);

  constructor(private readonly amqp: AmqpConnection) {}

  async publish<T extends Record<string, unknown>>(
    routingKey: string,
    payload: T,
  ): Promise<void> {
    const message = {
      ...payload,
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
      source: 'products-service',
    };
    try {
      await this.amqp.publish(SHARED_EXCHANGE_NAME, routingKey, message);
      this.logger.log(`Evento publicado: ${routingKey}`);
    } catch (error) {
      // No interrumpimos el flujo si el bus falla momentáneamente; el estado ya
      // quedó persistido y puede reconciliarse.
      this.logger.error(
        `Error publicando evento ${routingKey}: ${(error as Error).message}`,
      );
    }
  }
}
