import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  ServiceBusClient,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
  ProcessErrorArgs,
} from '@azure/service-bus';
import {
  SHARED_TOPIC_NAME,
  SHARED_SUBSCRIPTION_NAME,
} from './shared-bus.config';
import { SERVICE_BUS_CLIENT } from './shared-bus.module';
import { OrderEventsConsumer } from '../../features/cart/messaging/order-events.consumer';
import { IdentityEventsConsumer } from '../../features/stores/messaging/identity-events.consumer';

/**
 * Único receiver de products-service sobre la subscription propia del topic compartido.
 * Reemplaza a los dos @RabbitSubscribe/amqplib (order.# e identity.store.*): una sola
 * subscription recibe ambos dominios (filtro SQL en Terraform) y aquí se despacha por
 * el prefijo del routing-key (Subject del mensaje).
 *
 * maxConcurrentCalls=1: procesa estrictamente en orden (equivale al prefetchCount=1 que
 * exigía OrderEventsConsumer: `order.cart.item_changed` debe asentarse antes que el
 * `order.order.created` de la misma orden).
 */
@Injectable()
export class ServiceBusSubscriberService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ServiceBusSubscriberService.name);
  private receiver?: ServiceBusReceiver;

  constructor(
    @Inject(SERVICE_BUS_CLIENT) private readonly client: ServiceBusClient,
    private readonly orderConsumer: OrderEventsConsumer,
    private readonly identityConsumer: IdentityEventsConsumer,
  ) {}

  onModuleInit(): void {
    this.receiver = this.client.createReceiver(
      SHARED_TOPIC_NAME,
      SHARED_SUBSCRIPTION_NAME,
    );

    this.receiver.subscribe(
      {
        processMessage: async (msg: ServiceBusReceivedMessage) => {
          const routingKey = (
            msg.subject ??
            (msg.applicationProperties?.routingKey as string | undefined) ??
            ''
          ).toString();
          const body = (msg.body ?? {}) as Record<string, any>;

          if (routingKey.startsWith('order.')) {
            // El consumer captura sus errores de datos (idempotente) → se completa.
            await this.orderConsumer.handle(routingKey, body);
          } else if (routingKey.startsWith('identity.')) {
            // handleStoreEvent lanza en error transitorio → abandona/reintenta.
            await this.identityConsumer.handleStoreEvent(routingKey, body);
          } else {
            this.logger.debug(`Routing key ignorada: ${routingKey}`);
          }
        },
        processError: async (args: ProcessErrorArgs) => {
          this.logger.error(
            `Error en el receiver de Service Bus (${args.entityPath}): ${args.error.message}`,
          );
        },
      },
      { maxConcurrentCalls: 1 },
    );

    this.logger.log(
      `Suscrito a Service Bus topic="${SHARED_TOPIC_NAME}" subscription="${SHARED_SUBSCRIPTION_NAME}"`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.receiver?.close();
  }
}
