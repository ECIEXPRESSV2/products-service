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
        // OrderEventsConsumer depende de que `order.cart.item_changed` (que escribe
        // la proyección cart_lines) termine de procesarse ANTES que el siguiente
        // `order.order.created` de la misma orden (que la lee para reservar stock).
        // El default de la librería es prefetchCount=10: permite procesar varios
        // mensajes en paralelo, lo que puede hacer que `order.order.created` se
        // procese antes de que el insert anterior haya hecho commit, perdiendo la
        // reserva en silencio. prefetchCount=1 fuerza orden estrictamente secuencial.
        prefetchCount: 1,
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
