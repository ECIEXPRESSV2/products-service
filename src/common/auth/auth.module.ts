import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GatewayAuthGuard } from '../guards/gateway-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

/**
 * Auth de products-service basado en el patrón gateway: NO valida el token de Firebase,
 * confía en los headers `x-user-id` / `x-user-role` que inyecta el API Gateway (igual que
 * fulfillment, financial y notifications).
 */
@Module({
  providers: [
    // Orden importa: GatewayAuthGuard puebla req.user antes de que RolesGuard lo lea.
    { provide: APP_GUARD, useClass: GatewayAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
