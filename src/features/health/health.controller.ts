import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RabbitMQHealthIndicator } from './indicators/rabbitmq.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly typeOrmIndicator: TypeOrmHealthIndicator,
    private readonly rabbitMQIndicator: RabbitMQHealthIndicator,
  ) {}

  @Get('live')
  @Public()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Indica si el proceso está corriendo y puede responder requests. No verifica dependencias externas (DB, RabbitMQ) — usar para liveness probes de Kubernetes/Render.',
  })
  @ApiResponse({ status: 200, description: 'El proceso está vivo' })
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Verifica que el servicio puede atender tráfico: conexión a PostgreSQL y a RabbitMQ. Usar para readiness probes.',
  })
  @ApiResponse({ status: 200, description: 'Todas las dependencias están saludables' })
  @ApiResponse({ status: 503, description: 'Al menos una dependencia no está disponible' })
  readiness() {
    return this.healthCheckService.check([
      () => this.typeOrmIndicator.pingCheck('database'),
      () => this.rabbitMQIndicator.check('rabbitmq'),
    ]);
  }

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check completo (alias de /health/ready)',
  })
  @ApiResponse({ status: 200, description: 'Todas las dependencias están saludables' })
  @ApiResponse({ status: 503, description: 'Al menos una dependencia no está disponible' })
  check() {
    return this.readiness();
  }
}
