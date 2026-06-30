import {
  Global,
  Inject,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServiceBusClient } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { SERVICE_BUS_CLIENT } from './service-bus.tokens';
import { SharedEventPublisher } from './shared-event-publisher.service';

/**
 * Módulo global del bus de eventos compartido (Azure Service Bus). Crea un único
 * `ServiceBusClient` autenticado con Managed Identity (DefaultAzureCredential) contra
 * el FQDN del namespace, y expone `SharedEventPublisher`. Reemplaza al RabbitMQModule
 * (@golevelup/amqplib).
 *
 * Es @Global para no reimportar en cada feature que publique en el bus compartido.
 * Nota de orden: el consumo estrictamente secuencial que antes daba prefetchCount=1
 * se preserva con maxConcurrentCalls=1 en el receiver (ver ServiceBusSubscriberService).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SERVICE_BUS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ServiceBusClient => {
        const connStr = process.env.SERVICE_BUS_CONNECTION_STRING;
        if (connStr) return new ServiceBusClient(connStr);
        const fqns = config.getOrThrow<string>(
          'SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE',
        );
        return new ServiceBusClient(fqns, new DefaultAzureCredential());
      },
    },
    SharedEventPublisher,
  ],
  exports: [SERVICE_BUS_CLIENT, SharedEventPublisher],
})
export class SharedBusModule implements OnApplicationShutdown {
  constructor(
    @Inject(SERVICE_BUS_CLIENT) private readonly client: ServiceBusClient,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
