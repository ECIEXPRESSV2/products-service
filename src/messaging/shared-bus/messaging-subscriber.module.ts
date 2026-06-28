import { Module } from '@nestjs/common';
import { CartModule } from '../../features/cart/cart.module';
import { StoresModule } from '../../features/stores/stores.module';
import { ServiceBusSubscriberService } from './service-bus-subscriber.service';

/**
 * Registra el único receiver de Service Bus, que despacha a los consumers de las
 * features (OrderEventsConsumer en Cart, IdentityEventsConsumer en Stores). Importa
 * esos módulos para inyectar sus consumers; el ServiceBusClient viene del
 * SharedBusModule global.
 */
@Module({
  imports: [CartModule, StoresModule],
  providers: [ServiceBusSubscriberService],
})
export class MessagingSubscriberModule {}
