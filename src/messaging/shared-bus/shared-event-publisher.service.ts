import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ServiceBusClient, ServiceBusSender } from '@azure/service-bus';
import { SHARED_TOPIC_NAME } from './shared-bus.config';
import { SERVICE_BUS_CLIENT } from './service-bus.tokens';

/**
 * Publica eventos de products-service sobre el topic compartido `eciexpress_events`
 * (Azure Service Bus). Los campos de negocio van planos en el primer nivel; este
 * publisher añade el sobre estándar uniforme del bus (`occurredAt`, `source`,
 * `idempotencyKey`, `eventVersion`, `correlationId`).
 *
 * El tipo de evento lo identifica la routing key, que viaja como el `subject` del
 * mensaje (y también en applicationProperties.routingKey). Las reglas SQL de las
 * subscriptions filtran por ese subject.
 */
@Injectable()
export class SharedEventPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(SharedEventPublisher.name);
  private readonly sender: ServiceBusSender;

  constructor(
    @Inject(SERVICE_BUS_CLIENT) private readonly client: ServiceBusClient,
  ) {
    this.sender = this.client.createSender(SHARED_TOPIC_NAME);
  }

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
      await this.sender.sendMessages({
        body: message,
        subject: routingKey,
        applicationProperties: { routingKey },
      });
      this.logger.log(`Evento publicado: ${routingKey}`);
    } catch (error) {
      // No interrumpimos el flujo si el bus falla momentáneamente; el estado ya
      // quedó persistido y puede reconciliarse.
      this.logger.error(
        `Error publicando evento ${routingKey}: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.sender.close();
  }
}
