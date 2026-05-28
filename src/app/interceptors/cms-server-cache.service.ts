import { Injectable } from '@angular/core';

export interface CacheEntry {
  value: unknown;
  expires: number; // epoch ms
}

/**
 * Server-side TTL cache. Intended use: the `cmsCacheInterceptor` reads/writes
 * this on the SSR Node process only — every interceptor code path is gated on
 * `isPlatformServer(...)`. Registered with `providedIn: 'root'` for ergonomics
 * (no separate browser/server registration); the browser DI tree gets an empty
 * instance that is never touched.
 */
@Injectable({ providedIn: 'root' })
export class CmsServerCache {
  private readonly store = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: CacheEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}
