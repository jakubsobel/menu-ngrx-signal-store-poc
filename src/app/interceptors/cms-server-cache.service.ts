import { Injectable } from '@angular/core';

export interface CacheEntry {
  value: unknown;
  expires: number; // epoch ms
}

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
