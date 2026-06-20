import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import { IdentityAuthClient } from './identity-auth.client';
import { AuthCacheService } from './auth-cache.service';
import { RemoteAuthGuard } from '../guards/remote-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

@Module({
  imports: [HttpModule],
  providers: [
    IdentityAuthClient,
    AuthCacheService,
    // Orden importa: RemoteAuthGuard puebla req.user antes de que RolesGuard lo lea.
    { provide: APP_GUARD, useClass: RemoteAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
