import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restringe un endpoint a uno de los roles dados (lógica OR).
 * ADMIN siempre pasa, sin importar la lista (ver RolesGuard).
 * Sin este decorator, el endpoint solo exige estar autenticado.
 */
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
