import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

/**
 * Indicador de salud del bus de eventos (Azure Service Bus).
 *
 * Chequeo ligero de configuración: verifica que el FQDN del namespace esté presente
 * (lo inyecta Terraform vía Managed Identity). No abre una conexión AMQP en cada
 * readiness probe para no añadir latencia/costo; la conectividad real se valida al
 * crear el receiver/sender en el arranque.
 */
@Injectable()
export class ServiceBusHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly configService: ConfigService,
  ) {}

  check(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const fqns = this.configService.get<string>(
      'SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE',
    );

    if (fqns) {
      return indicator.up({ namespace: fqns });
    }
    return indicator.down({
      message: 'SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE no configurado',
    });
  }
}
