import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthenticatedUser } from './identity-auth.client';

interface CacheEntry {
  user: AuthenticatedUser;
  expiresAt: number;
}

const TTL_MS = 60_000;

/**
 * Cachea el resultado de GET /auth/validate por token (~60s, igual TTL que
 * PermissionsCacheService en identity-service) para no pagar un round-trip
 * HTTP en cada request de products-service.
 */
@Injectable()
export class AuthCacheService {
  private readonly store = new Map<string, CacheEntry>();

  get(token: string): AuthenticatedUser | null {
    const key = this.hash(token);
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.user;
  }

  set(token: string, user: AuthenticatedUser): void {
    this.store.set(this.hash(token), { user, expiresAt: Date.now() + TTL_MS });
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
