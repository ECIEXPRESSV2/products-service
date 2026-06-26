import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { SHARED_EXCHANGE_NAME } from './shared-bus.config';

/**
 * Publica eventos de products-service sobre el exchange topic compartido
 * `eciexpress_events`. Los campos de negocio van planos en el primer nivel; este
 * publisher añade el sobre estándar uniforme del bus (`occurredAt`, `source`,
 * `idempotencyKey`, `eventVersion`, `correlationId`). El tipo de evento lo identifica
 * la routing key, no se duplica en el cuerpo.
 */
@Injectable()
export class SharedEventPublisher {
  private readonly logger = new Logger(SharedEventPublisher.name);

  constructor(private readonly amqp: AmqpConnection) {}

  async publish<T extends object>(
    routingKey: string,
    payload: T,
  ): Promise<void> {
    // Vista para leer metadata opcional que el llamador pudo haber propagado
    // (correlationId, etc.) sin exigir un index signature en los payloads tipados.
    const meta = payload as Record<string, unknown>;
    const message = {
      ...payload,
      occurredAt:
        (meta.occurredAt as string | undefined) ?? new Date().toISOString(),
      source: 'products-service',
      idempotencyKey:
        (meta.idempotencyKey as string | undefined) ?? randomUUID(),
      eventVersion: (meta.eventVersion as number | undefined) ?? 1,
      correlationId: (meta.correlationId as string | undefined) ?? null,
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
