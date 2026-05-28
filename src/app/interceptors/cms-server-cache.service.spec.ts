import { TestBed } from '@angular/core/testing';
import { CmsServerCache } from './cms-server-cache.service';

describe('CmsServerCache', () => {
  let cache: CmsServerCache;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    cache = TestBed.inject(CmsServerCache);
  });

  it('returns undefined for unknown keys', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('stores and retrieves values', () => {
    cache.set('k', { value: 42, expires: Date.now() + 1000 });
    expect(cache.get('k')?.value).toBe(42);
  });

  it('returns the entry even when expired (consumer checks expiry)', () => {
    cache.set('k', { value: 42, expires: Date.now() - 1 });
    expect(cache.get('k')).toBeDefined();
  });

  it('delete removes the entry', () => {
    cache.set('k', { value: 42, expires: Date.now() + 1000 });
    cache.delete('k');
    expect(cache.get('k')).toBeUndefined();
  });
});
