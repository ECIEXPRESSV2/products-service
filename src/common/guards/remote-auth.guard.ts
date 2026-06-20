import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IdentityAuthClient, AuthenticatedUser } from '../auth/identity-auth.client';
import { AuthCacheService } from '../auth/auth-cache.service';

export type RequestWithUser = Request & { user: AuthenticatedUser };

/**
 * Equivalente a FirebaseAuthGuard de identity-service, pero en vez de
 * verificar el JWT de Firebase localmente, reenvía el Bearer token a
 * identity-service (GET /auth/validate) y cachea el resultado ~60s.
 */
@Injectable()
export class RemoteAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly identityAuthClient: IdentityAuthClient,
    private readonly authCache: AuthCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Los handlers RabbitMQ (@EventPattern) no tienen Request HTTP — no aplica auth.
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(req);

    const cached = this.authCache.get(token);
    if (cached) {
      req.user = cached;
      return true;
    }

    const user = await this.identityAuthClient.validate(token);
    this.authCache.set(token, user);
    req.user = user;
    return true;
  }

  private extractToken(req: Request): string {
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }
    return header.slice(7);
  }
}
