import { Inject, Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as amqplib from 'amqplib';
import type { IStoreSyncService } from '../services/store-sync.service.interface';
import { STORE_SYNC_SERVICE } from '../services/store-sync.service.interface';

interface IdentityStoreEventEnvelope {
  storeId: string;
}

/**
 * Consume eventos `identity.store.*` publicados por identity-service en el
 * exchange topic compartido `eciexpress_events`.
 *
 * identity-service publica con amqplib "crudo" (JSON plano, sin el envoltorio
 * {pattern,data} que usa @nestjs/microservices), y los routing keys son
 * patrones de exchange topic — no nombres de cola. El transporte RMQ de Nest
 * solo sabe consumir una cola fija con mensajes en su propio formato, así que
 * no puede bindear un exchange topic por patrón; por eso este consumidor usa
 * amqplib directamente, igual que el lado publicador de identity-service.
 *
 * El evento solo dispara la reconciliación (pull) contra el endpoint interno
 * de Identity — varios eventos del catálogo (`identity.store.updated`,
 * `identity.store.status_changed`, etc.) no incluyen el snapshot completo de
 * la tienda en el payload, así que el evento se trata como notificación de
 * cambio y no como fuente de datos.
 */
@Injectable()
export class IdentityEventsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  private readonly url: string;
  private readonly exchange: string;
  private readonly queue = 'products_service.identity_store_events';
  private readonly bindingPattern = 'identity.store.*';

  constructor(
    private readonly configService: ConfigService,
    @Inject(STORE_SYNC_SERVICE)
    private readonly storeSyncService: IStoreSyncService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    this.url = this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://guest:guest@localhost:5672',
    );
    this.exchange = this.configService.get<string>('RABBITMQ_EXCHANGE', 'eciexpress_events');
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      await this.channel.assertQueue(this.queue, { durable: true });
      await this.channel.bindQueue(this.queue, this.exchange, this.bindingPattern);
      await this.channel.prefetch(10);

      await this.channel.consume(this.queue, (msg) => this.handleMessage(msg), { noAck: false });

      this.connection.once('error', (err: unknown) => {
        this.logger.error(`RabbitMQ connection error in identity events consumer: ${err}`, IdentityEventsConsumer.name);
        this.channel = null;
        this.connection = null;
      });

      this.logger.log(
        `Subscribed to exchange="${this.exchange}" pattern="${this.bindingPattern}" queue="${this.queue}"`,
        IdentityEventsConsumer.name,
      );
    } catch (error) {
      this.logger.error(
        `Could not connect to RabbitMQ for identity events: ${error}`,
        IdentityEventsConsumer.name,
      );
    }
  }

  private async handleMessage(msg: amqplib.ConsumeMessage | null): Promise<void> {
    if (!msg || !this.channel) return;

    try {
      const event = JSON.parse(msg.content.toString()) as IdentityStoreEventEnvelope;

      if (!event.storeId) {
        this.logger.warn(`Identity store event without storeId, discarding: ${msg.content.toString()}`, IdentityEventsConsumer.name);
        this.channel.ack(msg);
        return;
      }

      // El tipo de evento se identifica por la routing key (el envelope estándar ya
      // no duplica `eventType` en el cuerpo).
      this.logger.log(
        `Received routingKey=${msg.fields.routingKey} for store=${event.storeId}`,
        IdentityEventsConsumer.name,
      );

      await this.storeSyncService.reconcile(event.storeId);
      this.channel.ack(msg);
    } catch (error) {
      this.logger.error(
        `Failed to process identity store event, requeueing: ${error}`,
        IdentityEventsConsumer.name,
      );
      // requeue=true: error transitorio (red, DB). RabbitMQ reentrega el mensaje.
      this.channel.nack(msg, false, true);
    }
  }
}
