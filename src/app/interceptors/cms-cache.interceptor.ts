import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Observable, of, tap } from 'rxjs';
import { CmsServerCache } from './cms-server-cache.service';

const TTL_PAGE_MS = 60_000;
const TTL_LIST_MS = 300_000;

function ttlFor(url: string): number {
  if (
    url.startsWith('/api/menu') ||
    url.startsWith('/api/footer') ||
    url.startsWith('/api/sitemap')
  ) {
    return TTL_LIST_MS;
  }
  return TTL_PAGE_MS;
}

export const cmsCacheInterceptor: HttpInterceptorFn = (
  req,
  next,
): Observable<HttpEvent<unknown>> => {
  const isServer = isPlatformServer(inject(PLATFORM_ID));
  if (!isServer) return next(req);
  if (req.method !== 'GET' || !req.url.startsWith('/api/')) return next(req);

  const cache = inject(CmsServerCache);
  const hit = cache.get(req.url);
  if (hit && hit.expires > Date.now()) {
    return of(new HttpResponse({ status: 200, body: hit.value }));
  }

  const ttl = ttlFor(req.url);
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.status === 200) {
        cache.set(req.url, { value: event.body, expires: Date.now() + ttl });
      }
    }),
  );
};
