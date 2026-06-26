import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** Headers que el API Gateway inyecta tras autenticar al usuario. */
export const GATEWAY_HEADERS = {
  userId: 'x-user-id',
  role: 'x-user-role',
  storeId: 'x-user-store',
} as const;

/** Identidad reconstruida desde los headers del gateway. */
export interface AuthenticatedUser {
  userId: string;
  /** Rol único que inyecta el gateway (`x-user-role`). */
  role?: string;
  /** Roles como arreglo (derivado de `role`) para que RolesGuard los compruebe. */
  roles: string[];
  /** Punto de venta asociado (`x-user-store`), si aplica. */
  storeId?: string;
}

export type RequestWithUser = Request & { user: AuthenticatedUser };

/**
 * Igual que el GatewayAuthGuard de fulfillment/financial/notifications: products NO valida
 * el token de Firebase. Confía en que el API Gateway ya autenticó al usuario y reconstruye
 * `request.user` desde los headers `x-user-id` / `x-user-role` / `x-user-store`. En producción
 * el gateway debe estar aislado a nivel de red para que nadie pueda falsificar estos headers.
 */
@Injectable()
export class GatewayAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Los handlers del bus (@RabbitSubscribe) no son peticiones HTTP — no aplica auth.
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = this.header(req, GATEWAY_HEADERS.userId);

    if (!userId) {
      throw new UnauthorizedException({
        code: 'GATEWAY_AUTH_REQUIRED',
        message:
          'No pudimos identificar tu sesión. Inicia sesión e inténtalo de nuevo.',
      });
    }

    const role = this.header(req, GATEWAY_HEADERS.role);
    req.user = {
      userId,
      role,
      roles: role ? [role] : [],
      storeId: this.header(req, GATEWAY_HEADERS.storeId),
    };

    return true;
  }

  private header(req: Request, name: string): string | undefined {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
