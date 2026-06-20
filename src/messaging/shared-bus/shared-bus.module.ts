import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { SHARED_EXCHANGE_NAME } from './shared-bus.config';
import { SharedEventPublisher } from './shared-event-publisher.service';

/**
 * Módulo global del bus de eventos compartido (CloudAMQP). Declara el exchange
 * topic `eciexpress_events` y expone `AmqpConnection` (para los @RabbitSubscribe de
 * los consumidores) y `SharedEventPublisher`. La URL llega por `RABBITMQ_URL`.
 *
 * Es @Global para no reimportar RabbitMQModule en cada feature que consuma o
 * publique en el bus compartido.
 */
@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('RABBITMQ_URL'),
        exchanges: [
          {
            name: SHARED_EXCHANGE_NAME,
            type: 'topic',
            createExchangeIfNotExists: true,
            options: { durable: true },
          },
        ],
        // No bloquea el arranque si CloudAMQP tarda en responder; el
        // connection-manager reintenta y reasienta colas/bindings al reconectar.
        connectionInitOptions: { wait: false },
      }),
    }),
  ],
  providers: [SharedEventPublisher],
  exports: [RabbitMQModule, SharedEventPublisher],
})
export class SharedBusModule {}
