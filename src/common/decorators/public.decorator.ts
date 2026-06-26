import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Salta GatewayAuthGuard por completo — no requiere `x-user-id`. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
