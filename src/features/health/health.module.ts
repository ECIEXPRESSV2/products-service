import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ServiceBusHealthIndicator } from './indicators/service-bus.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [ServiceBusHealthIndicator],
})
export class HealthModule {}
