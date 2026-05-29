import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { cmsCacheInterceptor } from './cms-cache.interceptor';
import { CmsServerCache } from './cms-server-cache.service';

describe('cmsCacheInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let cache: CmsServerCache;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([cmsCacheInterceptor])),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    cache = TestBed.inject(CmsServerCache);
  });

  afterEach(() => httpMock.verify());

  it('forwards GETs to /api/* and caches the response', () => {
    http.get('/api/page/foo').subscribe();
    const req = httpMock.expectOne('/api/page/foo');
    req.flush({ slug: 'foo' });

    expect(cache.get('/api/page/foo')?.value).toEqual({ slug: 'foo' });
  });

  it('serves a cached response without hitting the network', () => {
    cache.set('/api/page/bar', { value: { slug: 'bar' }, expires: Date.now() + 60_000 });

    let received: unknown;
    http.get('/api/page/bar').subscribe(v => (received = v));

    httpMock.expectNone('/api/page/bar');
    expect(received).toEqual({ slug: 'bar' });
  });

  it('refetches when the cached entry has expired', () => {
    cache.set('/api/page/baz', { value: { slug: 'old' }, expires: Date.now() - 1 });

    http.get('/api/page/baz').subscribe();
    const req = httpMock.expectOne('/api/page/baz');
    req.flush({ slug: 'new' });
  });

  it('does not cache non-GET requests', () => {
    http.post('/api/page/foo', {}).subscribe();
    httpMock.expectOne('/api/page/foo').flush({});
    expect(cache.get('/api/page/foo')).toBeUndefined();
  });

  it('does not cache non-/api/ URLs', () => {
    http.get('/other/thing').subscribe();
    httpMock.expectOne('/other/thing').flush({});
    expect(cache.get('/other/thing')).toBeUndefined();
  });

  it('uses the longer TTL for /api/menu, /api/footer, /api/sitemap', () => {
    const before = Date.now();
    http.get('/api/menu').subscribe();
    httpMock.expectOne('/api/menu').flush([]);
    const entry = cache.get('/api/menu');
    expect(entry?.expires).toBeGreaterThan(before + 240_000); // > 4 min, well above the 60s page TTL
  });
});

describe('cmsCacheInterceptor on the browser', () => {
  it('passes through without caching', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([cmsCacheInterceptor])),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);
    const cache = TestBed.inject(CmsServerCache);

    http.get('/api/page/foo').subscribe();
    httpMock.expectOne('/api/page/foo').flush({ slug: 'foo' });
    expect(cache.get('/api/page/foo')).toBeUndefined();
    httpMock.verify();
  });
});
