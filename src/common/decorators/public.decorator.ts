import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Salta RemoteAuthGuard por completo — no requiere token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
