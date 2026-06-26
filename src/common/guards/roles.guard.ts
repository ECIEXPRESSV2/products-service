import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/require-roles.decorator';
import type { RequestWithUser } from './gateway-auth.guard';

/**
 * Equivalente a PermissionsGuard de identity-service, pero por nombre de
 * rol en lugar de permisos resource:action (decisión: no se modela un
 * catálogo de permisos granular para products-service, solo roles).
 * ADMIN siempre pasa, igual que en identity-service.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    if (user.roles.includes('ADMIN')) return true;

    const hasRole = required.some((role) => user.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(`Se requiere uno de los siguientes roles: ${required.join(', ')}`);
    }

    return true;
  }
}
