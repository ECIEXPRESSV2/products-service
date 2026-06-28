import { Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { IStoreSyncService } from '../services/store-sync.service.interface';
import { STORE_SYNC_SERVICE } from '../services/store-sync.service.interface';

interface IdentityStoreEventEnvelope {
  storeId: string;
}

/**
 * Maneja eventos `identity.store.*` publicados por identity-service en el topic
 * compartido `eciexpress_events` (Azure Service Bus). Lo invoca el
 * ServiceBusSubscriberService con el routing-key y el body ya deserializado.
 *
 * El evento solo dispara la reconciliación (pull) contra el endpoint interno de
 * Identity — varios eventos del catálogo (`identity.store.updated`,
 * `identity.store.status_changed`, etc.) no incluyen el snapshot completo de la tienda
 * en el payload, así que el evento se trata como notificación de cambio y no como
 * fuente de datos.
 *
 * En error transitorio (red, DB) LANZA: el suscriptor abandona el mensaje y Service Bus
 * lo reentrega (equivalente al nack/requeue anterior); tras maxDeliveryCount va a la DLQ.
 */
@Injectable()
export class IdentityEventsConsumer {
  constructor(
    @Inject(STORE_SYNC_SERVICE)
    private readonly storeSyncService: IStoreSyncService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async handleStoreEvent(
    routingKey: string,
    body: Record<string, any>,
  ): Promise<void> {
    const event = body as IdentityStoreEventEnvelope;

    if (!event.storeId) {
      this.logger.warn(
        `Identity store event without storeId, discarding: ${routingKey}`,
        IdentityEventsConsumer.name,
      );
      return;
    }

    this.logger.log(
      `Received routingKey=${routingKey} for store=${event.storeId}`,
      IdentityEventsConsumer.name,
    );

    // No capturamos el error: que se propague para que el suscriptor abandone el
    // mensaje y Service Bus lo reentregue (error transitorio).
    await this.storeSyncService.reconcile(event.storeId);
  }
}
