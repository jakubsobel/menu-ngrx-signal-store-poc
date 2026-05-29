# CMS-Driven Dynamic Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the app to a fully CMS-driven dynamic-page system: single catch-all route renders any slug via SSR, with a signal-based PageStore caching pages across navigations, an `@defer`-per-type component registry, themed layouts, and WCAG 2.2 AA loading UX.

**Architecture:** Angular 21 + `@ngrx/signals` 21, signal-only data flow (`httpResource` + `linkedSignal` + `signalMethod` — no RxJS pipelines in stores). Root-scoped `PageStore` keyed by slug with `linkedSignal` accumulating cache; `CmsBlockHost` registry using `@switch` + `@defer (on viewport; prefetch on idle)`; `withIncrementalHydration()` so SSR fully renders all components for bots; HTTP interceptor for server-side TTL cache; per-page CSS-variable theming via `data-theme` attr.

**Tech Stack:** Angular 21.2, `@angular/ssr` 21.2, `@ngrx/signals` 21.1, signal-based primitives, Vitest + Angular TestBed for tests.

**Spec:** `docs/superpowers/specs/2026-05-28-cms-driven-pages-design.md`

**Scope of v1 (this plan):** Foundation + all three hero variants + two representative component types (FAQ, image-text) demonstrating the registry pattern + three themes (neutral/light/dark/gradient) + sitemap/robots/edge cache + migration from current static page components. Adding the remaining ~25 component types follows the documented "31st component" recipe in the spec and is out of scope here.

---

## File Structure

```
src/app/
  app.config.ts                                 # MODIFY: + withIncrementalHydration, withRouterConfig, withComponentInputBinding
  app.config.server.ts                          # MODIFY: + cmsCacheInterceptor
  app.routes.ts                                 # MODIFY: replace existing routes with catch-all
  app.html, app.ts                              # MODIFY: app shell — RouteProgress, skip link, <main>, RouteFocus, AppFooter

  interceptors/
    cms-server-cache.service.ts                 # CREATE: server-side TTL cache (Map<url, {value, expires}>)
    cms-cache.interceptor.ts                    # CREATE: HttpInterceptorFn, server-only, calls CmsServerCache

  shell/
    route-progress/route-progress.{ts,scss}     # CREATE: global top progress bar
    route-focus.directive.ts                    # CREATE: focus <main> on NavigationEnd
    skip-link/skip-link.{ts,scss}               # CREATE: focusable skip link

  footer/
    footer.{ts,html,scss}                       # CREATE: standalone AppFooter
    state/footer.store.ts                       # CREATE: mirror of MenuStore
    state/footer.types.ts                       # CREATE

  pages/
    cms-page/
      cms-page.{ts,html,scss}                   # CREATE: orchestrator
      page-waiter/page-waiter.{ts,scss}         # CREATE: Phase-1 full-area loader
      not-found/not-found.{ts,scss}             # CREATE: 404 view

    state/
      cms.types.ts                              # CREATE: CmsPage, HeroBlock, ComponentBlock union, SeoData, etc.
      page.store.ts                             # CREATE: signal-only store with linkedSignal cache
      page.types.ts                             # CREATE: PageState

  cms/
    block-host/
      cms-block-host.{ts,scss}                  # CREATE: registry + @switch + @defer
      block-header/cms-block-header.{ts,scss}   # CREATE: shared header

    hero/
      cms-hero-text.{ts,scss}                   # CREATE
      cms-hero-image.{ts,scss}                  # CREATE (uses NgOptimizedImage)
      cms-hero-video.{ts,scss}                  # CREATE

    components/
      faq/cms-faq.{ts,scss}                     # CREATE
      faq/cms-faq.skeleton.{ts,scss}            # CREATE
      image-text/cms-image-text.{ts,scss}       # CREATE
      image-text/cms-image-text.skeleton.{ts,scss} # CREATE

    seo/seo-sync.service.ts                     # CREATE

server.ts                                       # MODIFY: + sitemap, robots, edge cache headers

# REMOVE (migration):
src/app/pages/home/                             # DELETE
src/app/pages/article/                          # DELETE
src/app/pages/search/                           # DELETE
src/app/pages/checkout/                         # DELETE
```

**Testing notes:**
- Run the full suite via `npm test` (Angular CLI wraps Vitest).
- Run a single spec via `npx vitest run <path-to-spec>` for fast iteration.
- All component/store tests use Angular `TestBed` + Vitest globals (`describe`, `it`, `expect`).
- HTTP-using tests use `provideHttpClient(withFetch())` + `provideHttpClientTesting()`.

---

## Phase A — Foundation

### Task A1: Add `withIncrementalHydration()` and router options to client config

**Files:**
- Modify: `src/app/app.config.ts`

- [ ] **Step 1: Update app.config.ts**

Replace the file contents with:

```ts
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withRouterConfig,
} from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withRouterConfig({ scrollPositionRestoration: 'enabled' }),
      withComponentInputBinding(),
    ),
    provideHttpClient(withFetch()),
    provideClientHydration(
      withEventReplay(),
      withIncrementalHydration(),
    ),
  ],
};
```

- [ ] **Step 2: Build to verify config compiles**

Run: `npm run build`
Expected: build succeeds (warnings OK, no TS errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/app.config.ts
git commit -m "feat(config): add withIncrementalHydration + scroll restoration + input binding"
```

---

### Task A2: Define the CMS data contract types

**Files:**
- Create: `src/app/pages/state/cms.types.ts`

- [ ] **Step 1: Create cms.types.ts**

```ts
// src/app/pages/state/cms.types.ts

export type PageType =
  | 'landing-light'
  | 'landing-dark'
  | 'landing-gradient'
  | 'article-light'
  | 'article-dark';

export interface Cta {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary' | 'link';
}

export interface ImageRef {
  src: string;
  alt: string;
  width: number;
  height: number;
  decorative?: boolean;
}

export interface VideoRef {
  src: string;
  type: 'mp4' | 'webm' | 'youtube' | 'vimeo';
  captionsSrc?: string;
}

export interface SeoData {
  title: string;
  description: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  jsonLd?: object | object[];
}

export type HeroBlock =
  | { kind: 'text'; title: string; description?: string; cta?: Cta }
  | { kind: 'image'; title: string; description?: string; image: ImageRef; cta?: Cta }
  | { kind: 'video'; title: string; description?: string; video: VideoRef; poster?: ImageRef; cta?: Cta };

export interface ComponentBase {
  id: string;
  label?: string;
  title?: string;
  description?: string;
  cta?: Cta;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqFields {
  items: FaqItem[];
}

export interface ImageTextFields {
  image: ImageRef;
  body: string;
  layout?: 'image-left' | 'image-right';
}

export type ComponentBlock =
  | ({ kind: 'faq' } & ComponentBase & FaqFields)
  | ({ kind: 'image-text' } & ComponentBase & ImageTextFields);
// NOTE: extend this union as new component types are added (see spec "Adding the 31st component type").

export interface CmsPage {
  slug: string;
  pageType: PageType;
  seo: SeoData;
  hero: HeroBlock;
  components: ComponentBlock[];
}
```

- [ ] **Step 2: Build to verify types compile**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/state/cms.types.ts
git commit -m "feat(types): add CMS page data contract"
```

---

## Phase B — Server-side cache layer

### Task B1: Add `CmsServerCache` service

**Files:**
- Create: `src/app/interceptors/cms-server-cache.service.ts`
- Test: `src/app/interceptors/cms-server-cache.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/interceptors/cms-server-cache.service.spec.ts
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
```

- [ ] **Step 2: Run test — verify failure**

Run: `npx vitest run src/app/interceptors/cms-server-cache.service.spec.ts`
Expected: FAIL — "Cannot find module './cms-server-cache.service'".

- [ ] **Step 3: Implement the service**

```ts
// src/app/interceptors/cms-server-cache.service.ts
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
```

- [ ] **Step 4: Run test — verify pass**

Run: `npx vitest run src/app/interceptors/cms-server-cache.service.spec.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/app/interceptors/cms-server-cache.service.ts src/app/interceptors/cms-server-cache.service.spec.ts
git commit -m "feat(cache): add CmsServerCache service"
```

---

### Task B2: Add `cmsCacheInterceptor`

**Files:**
- Create: `src/app/interceptors/cms-cache.interceptor.ts`
- Test: `src/app/interceptors/cms-cache.interceptor.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/interceptors/cms-cache.interceptor.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
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
```

- [ ] **Step 2: Run test — verify failure**

Run: `npx vitest run src/app/interceptors/cms-cache.interceptor.spec.ts`
Expected: FAIL — "Cannot find module './cms-cache.interceptor'".

- [ ] **Step 3: Implement the interceptor**

```ts
// src/app/interceptors/cms-cache.interceptor.ts
import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Observable, of, tap } from 'rxjs';
import { CmsServerCache } from './cms-server-cache.service';

const TTL_PAGE_MS = 60_000;
const TTL_LIST_MS = 300_000;

function ttlFor(url: string): number {
  if (url.startsWith('/api/menu') || url.startsWith('/api/footer') || url.startsWith('/api/sitemap')) {
    return TTL_LIST_MS;
  }
  return TTL_PAGE_MS;
}

export const cmsCacheInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
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
```

- [ ] **Step 4: Run test — verify pass**

Run: `npx vitest run src/app/interceptors/cms-cache.interceptor.spec.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/app/interceptors/cms-cache.interceptor.ts src/app/interceptors/cms-cache.interceptor.spec.ts
git commit -m "feat(cache): add cmsCacheInterceptor for server-side TTL cache"
```

---

### Task B3: Wire the interceptor into the server config

**Files:**
- Modify: `src/app/app.config.server.ts`

- [ ] **Step 1: Update server config**

```ts
// src/app/app.config.server.ts
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { cmsCacheInterceptor } from './interceptors/cms-cache.interceptor';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(withFetch(), withInterceptors([cmsCacheInterceptor])),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build succeeds (both browser and server bundles).

- [ ] **Step 3: Commit**

```bash
git add src/app/app.config.server.ts
git commit -m "feat(server): wire cmsCacheInterceptor into server providers"
```

---

## Phase C — Stores and SEO service

### Task C1: `FooterStore` (mirror of MenuStore)

**Files:**
- Create: `src/app/footer/state/footer.types.ts`
- Create: `src/app/footer/state/footer.store.ts`
- Test: `src/app/footer/state/footer.store.spec.ts`

- [ ] **Step 1: Define footer types**

```ts
// src/app/footer/state/footer.types.ts
export interface FooterColumn {
  id: string;
  title: string;
  links: { id: string; label: string; href: string }[];
}

export interface FooterLegal {
  copyright: string;
  links: { id: string; label: string; href: string }[];
}

export interface FooterCmsData {
  columns: FooterColumn[];
  legal: FooterLegal;
}

export interface FooterState {
  // FooterStore reads everything from the httpResource; no extra state needed.
}
```

- [ ] **Step 2: Write failing store test**

```ts
// src/app/footer/state/footer.store.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FooterStore } from './footer.store';

describe('FooterStore', () => {
  let httpMock: HttpTestingController;
  let store: InstanceType<typeof FooterStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(FooterStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('exposes empty columns/legal until the resource resolves', () => {
    expect(store.columns()).toEqual([]);
    expect(store.legal()).toBeNull();
  });

  it('populates columns/legal once /api/footer resolves', async () => {
    const req = httpMock.expectOne('/api/footer');
    req.flush({
      columns: [{ id: 'about', title: 'About', links: [] }],
      legal: { copyright: '© 2026', links: [] },
    });

    // Allow microtask queue to flush httpResource state.
    await Promise.resolve();
    expect(store.columns()).toHaveLength(1);
    expect(store.legal()?.copyright).toBe('© 2026');
  });
});
```

- [ ] **Step 3: Run — verify failure**

Run: `npx vitest run src/app/footer/state/footer.store.spec.ts`
Expected: FAIL — "Cannot find module './footer.store'".

- [ ] **Step 4: Implement FooterStore**

```ts
// src/app/footer/state/footer.store.ts
import {
  PLATFORM_ID,
  TransferState,
  computed,
  inject,
  makeStateKey,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { signalStore, withComputed, withHooks, withProps } from '@ngrx/signals';
import { FooterCmsData } from './footer.types';

const FOOTER_STATE_KEY = makeStateKey<FooterCmsData>('footer.cache');

export const FooterStore = signalStore(
  { providedIn: 'root' },

  withProps(() => ({
    footerResource: httpResource<FooterCmsData>(() => '/api/footer'),
  })),

  withComputed((store) => ({
    footer: computed(() =>
      store.footerResource.hasValue() ? store.footerResource.value() : null,
    ),
    columns: computed(() =>
      store.footerResource.hasValue() ? store.footerResource.value().columns : [],
    ),
    legal: computed(() =>
      store.footerResource.hasValue() ? store.footerResource.value().legal : null,
    ),
    isLoading: computed(() => store.footerResource.isLoading()),
  })),

  withHooks((store) => ({
    onInit() {
      const ts = inject(TransferState);
      if (isPlatformServer(inject(PLATFORM_ID))) {
        ts.onSerialize(FOOTER_STATE_KEY, () =>
          store.footerResource.hasValue() ? store.footerResource.value() : null,
        );
      }
    },
  })),
);
```

- [ ] **Step 5: Run — verify pass**

Run: `npx vitest run src/app/footer/state/footer.store.spec.ts`
Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add src/app/footer/state/
git commit -m "feat(footer): add FooterStore (httpResource + TransferState)"
```

---

### Task C2: `PageStore` (signal-only with linkedSignal cache)

**Files:**
- Create: `src/app/pages/state/page.types.ts`
- Create: `src/app/pages/state/page.store.ts`
- Test: `src/app/pages/state/page.store.spec.ts`

- [ ] **Step 1: Define PageState type**

```ts
// src/app/pages/state/page.types.ts
export interface PageState {
  currentSlug: string | null;
}
```

- [ ] **Step 2: Write failing store test**

```ts
// src/app/pages/state/page.store.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PageStore } from './page.store';

describe('PageStore', () => {
  let httpMock: HttpTestingController;
  let store: InstanceType<typeof PageStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(PageStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts with no current slug and a null currentPage', () => {
    expect(store.currentSlug()).toBeNull();
    expect(store.currentPage()).toBeNull();
    expect(store.isCurrentNotFound()).toBe(false);
  });

  it('setCurrentSlug triggers a fetch and caches the result', async () => {
    store.setCurrentSlug('/foo');
    await Promise.resolve();

    const req = httpMock.expectOne('/api/page/%2Ffoo');
    req.flush({
      slug: '/foo',
      pageType: 'landing-light',
      seo: { title: 'Foo', description: 'd' },
      hero: { kind: 'text', title: 'Hello' },
      components: [],
    });

    await Promise.resolve();
    expect(store.currentPage()?.slug).toBe('/foo');
  });

  it('navigating back to a cached slug does not refetch', async () => {
    store.setCurrentSlug('/foo');
    await Promise.resolve();
    httpMock.expectOne('/api/page/%2Ffoo').flush({
      slug: '/foo',
      pageType: 'landing-light',
      seo: { title: 'Foo', description: 'd' },
      hero: { kind: 'text', title: 'Hello' },
      components: [],
    });
    await Promise.resolve();

    store.setCurrentSlug('/bar');
    await Promise.resolve();
    httpMock.expectOne('/api/page/%2Fbar').flush({
      slug: '/bar',
      pageType: 'landing-dark',
      seo: { title: 'Bar', description: 'd' },
      hero: { kind: 'text', title: 'Hi' },
      components: [],
    });
    await Promise.resolve();

    store.setCurrentSlug('/foo');
    await Promise.resolve();
    httpMock.expectNone('/api/page/%2Ffoo');
    expect(store.currentPage()?.slug).toBe('/foo');
  });

  it('records 404s and marks the slug as not found', async () => {
    store.setCurrentSlug('/missing');
    await Promise.resolve();

    const req = httpMock.expectOne('/api/page/%2Fmissing');
    req.flush('not found', { status: 404, statusText: 'Not Found' });

    await Promise.resolve();
    expect(store.isCurrentNotFound()).toBe(true);
    expect(store.currentPage()).toBeNull();
  });
});
```

- [ ] **Step 3: Run — verify failure**

Run: `npx vitest run src/app/pages/state/page.store.spec.ts`
Expected: FAIL — "Cannot find module './page.store'".

- [ ] **Step 4: Implement PageStore**

```ts
// src/app/pages/state/page.store.ts
import {
  PLATFORM_ID,
  TransferState,
  computed,
  inject,
  linkedSignal,
  makeStateKey,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { CmsPage } from './cms.types';
import { PageState } from './page.types';

interface CachePayload {
  pages: Record<string, CmsPage>;
  notFoundSlugs: string[];
}

const PAGES_STATE_KEY = makeStateKey<CachePayload>('page.cache');

export const PageStore = signalStore(
  { providedIn: 'root' },

  withState<PageState>({ currentSlug: null }),

  withProps((store) => {
    const pageResource = httpResource<CmsPage>(() => {
      const slug = store.currentSlug();
      return slug ? `/api/page/${encodeURIComponent(slug)}` : undefined;
    });

    const pageMap = linkedSignal<Record<string, CmsPage>>({
      source: () => (pageResource.hasValue() ? pageResource.value() : null),
      computation: (newPage, previous) => {
        const prevMap = previous?.value ?? {};
        if (!newPage) return prevMap;
        return { ...prevMap, [newPage.slug]: newPage };
      },
    });

    const notFoundSlugs = linkedSignal<ReadonlySet<string>>({
      source: () => ({
        slug: store.currentSlug(),
        status: pageResource.statusCode?.() ?? null,
      }),
      computation: ({ slug, status }, previous) => {
        const prev = previous?.value ?? new Set<string>();
        if (status === 404 && slug && !prev.has(slug)) {
          const next = new Set(prev);
          next.add(slug);
          return next;
        }
        return prev;
      },
    });

    return { pageResource, pageMap, notFoundSlugs };
  }),

  withComputed((store) => ({
    currentPage: computed(() => {
      const slug = store.currentSlug();
      return slug ? (store.pageMap()[slug] ?? null) : null;
    }),
    isCurrentNotFound: computed(() => {
      const slug = store.currentSlug();
      return slug != null && store.notFoundSlugs().has(slug);
    }),
    isCurrentLoading: computed(() => {
      const slug = store.currentSlug();
      return (
        slug != null &&
        !store.pageMap()[slug] &&
        !store.notFoundSlugs().has(slug) &&
        store.pageResource.isLoading()
      );
    }),
  })),

  withMethods((store) => ({
    setCurrentSlug: signalMethod<string>((slug) => {
      if (store.currentSlug() !== slug) {
        patchState(store, { currentSlug: slug });
      }
    }),
  })),

  withHooks((store) => ({
    onInit() {
      const platformId = inject(PLATFORM_ID);
      const ts = inject(TransferState);
      if (isPlatformServer(platformId)) {
        ts.onSerialize(PAGES_STATE_KEY, () => ({
          pages: store.pageMap(),
          notFoundSlugs: [...store.notFoundSlugs()],
        }));
      } else {
        const seeded = ts.get(PAGES_STATE_KEY, null);
        if (seeded) {
          store.pageMap.set(seeded.pages);
          store.notFoundSlugs.set(new Set(seeded.notFoundSlugs));
        }
      }
    },
  })),
);
```

- [ ] **Step 5: Run — verify pass**

Run: `npx vitest run src/app/pages/state/page.store.spec.ts`
Expected: PASS (4/4).

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/state/
git commit -m "feat(page-store): add PageStore (httpResource + linkedSignal cache + signalMethod)"
```

---

### Task C3: `SeoSyncService`

**Files:**
- Create: `src/app/cms/seo/seo-sync.service.ts`
- Test: `src/app/cms/seo/seo-sync.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/cms/seo/seo-sync.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { SeoSyncService } from './seo-sync.service';
import { SeoData } from '../../pages/state/cms.types';

describe('SeoSyncService', () => {
  let svc: SeoSyncService;
  let meta: Meta;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    svc = TestBed.inject(SeoSyncService);
    meta = TestBed.inject(Meta);
    doc = TestBed.inject(DOCUMENT);
    doc.head.querySelectorAll('meta, link[rel="canonical"], script[type="application/ld+json"]').forEach(n => n.remove());
  });

  it('applyMeta sets description, robots default, OG, twitter', () => {
    const seo: SeoData = {
      title: 'T',
      description: 'D',
      ogImage: 'https://example.com/og.png',
    };
    svc.applyMeta(seo);
    expect(meta.getTag('name="description"')?.content).toBe('D');
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
    expect(meta.getTag('property="og:title"')?.content).toBe('T');
    expect(meta.getTag('property="og:image"')?.content).toBe('https://example.com/og.png');
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
  });

  it('applyJsonLd inserts a script tag with the payload', () => {
    svc.applyJsonLd({ '@type': 'Article', name: 'X' });
    const script = doc.head.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent!)).toEqual({ '@type': 'Article', name: 'X' });
  });

  it('applyJsonLd replaces a previous tag', () => {
    svc.applyJsonLd({ '@type': 'A' });
    svc.applyJsonLd({ '@type': 'B' });
    const scripts = doc.head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].textContent!)).toEqual({ '@type': 'B' });
  });

  it('applyJsonLd(undefined) removes the existing tag', () => {
    svc.applyJsonLd({ '@type': 'A' });
    svc.applyJsonLd(undefined);
    expect(doc.head.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify failure**

Run: `npx vitest run src/app/cms/seo/seo-sync.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SeoSyncService**

```ts
// src/app/cms/seo/seo-sync.service.ts
import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { SeoData } from '../../pages/state/cms.types';

@Injectable({ providedIn: 'root' })
export class SeoSyncService {
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private jsonLdEl: HTMLScriptElement | null = null;

  applyMeta(seo: SeoData): void {
    this.upsertName('description', seo.description);
    this.upsertName('robots', seo.robots ?? 'index, follow');
    this.upsertLink('canonical', seo.canonical);

    this.upsertProperty('og:title', seo.ogTitle ?? seo.title);
    this.upsertProperty('og:description', seo.ogDescription ?? seo.description);
    if (seo.ogImage) this.upsertProperty('og:image', seo.ogImage);

    this.upsertName('twitter:card', seo.twitterCard ?? 'summary_large_image');
  }

  applyJsonLd(jsonLd: object | object[] | undefined): void {
    if (this.jsonLdEl) {
      this.jsonLdEl.remove();
      this.jsonLdEl = null;
    }
    if (!jsonLd) return;
    const el = this.doc.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(jsonLd);
    this.doc.head.appendChild(el);
    this.jsonLdEl = el;
  }

  private upsertName(name: string, content: string | undefined): void {
    if (!content) {
      this.meta.removeTag(`name="${name}"`);
      return;
    }
    this.meta.updateTag({ name, content });
  }

  private upsertProperty(property: string, content: string | undefined): void {
    if (!content) {
      this.meta.removeTag(`property="${property}"`);
      return;
    }
    this.meta.updateTag({ property, content });
  }

  private upsertLink(rel: string, href: string | undefined): void {
    let existing = this.doc.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!href) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.href = href;
    } else {
      existing = this.doc.createElement('link');
      existing.rel = rel;
      existing.href = href;
      this.doc.head.appendChild(existing);
    }
  }
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/app/cms/seo/seo-sync.service.spec.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/app/cms/seo/
git commit -m "feat(seo): add SeoSyncService for title/meta/JSON-LD"
```

---

## Phase D — Presentational primitives

### Task D1: `PageWaiter`

**Files:**
- Create: `src/app/pages/cms-page/page-waiter/page-waiter.ts`
- Create: `src/app/pages/cms-page/page-waiter/page-waiter.scss`

- [ ] **Step 1: Implement PageWaiter component**

```ts
// src/app/pages/cms-page/page-waiter/page-waiter.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-page-waiter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    'aria-label': 'Loading page',
  },
  template: `
    <div class="waiter">
      <div class="brand-mark" aria-hidden="true">◆</div>
      <span class="visually-hidden">Loading page…</span>
    </div>
  `,
  styleUrl: './page-waiter.scss',
})
export class PageWaiter {}
```

- [ ] **Step 2: Add styles**

```scss
// src/app/pages/cms-page/page-waiter/page-waiter.scss
:host {
  display: block;
  min-height: 60vh;
  background: var(--shell-bg, #ffffff);
  color: var(--shell-fg, #111827);
}

.waiter {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  flex-direction: column;
  gap: 1rem;
}

.brand-mark {
  font-size: 3rem;
  opacity: 0.7;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%      { opacity: 0.9; transform: scale(1.05); }
}

@media (prefers-reduced-motion: reduce) {
  .brand-mark { animation: none; opacity: 0.7; }
}

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/cms-page/page-waiter/
git commit -m "feat(cms-page): add PageWaiter component"
```

---

### Task D2: `NotFoundPage`

**Files:**
- Create: `src/app/pages/cms-page/not-found/not-found.ts`
- Create: `src/app/pages/cms-page/not-found/not-found.scss`

- [ ] **Step 1: Implement NotFoundPage**

```ts
// src/app/pages/cms-page/not-found/not-found.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { role: 'main' },
  template: `
    <section class="not-found">
      <h1>Page not found</h1>
      <p>The page you’re looking for isn’t available.</p>
      <a routerLink="/" class="home-link">Go to home</a>
    </section>
  `,
  styleUrl: './not-found.scss',
})
export class NotFoundPage {}
```

- [ ] **Step 2: Add styles**

```scss
// src/app/pages/cms-page/not-found/not-found.scss
:host {
  display: block;
  background: var(--bg, #ffffff);
  color: var(--fg, #111827);
}

.not-found {
  max-width: 40rem;
  margin: 0 auto;
  padding: 4rem 1.5rem;
  text-align: center;
}

h1 { font-size: 2.5rem; margin: 0 0 1rem; }
p  { margin: 0 0 2rem; }

.home-link {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  background: var(--accent, #2563eb);
  color: #fff;
  text-decoration: none;
}
.home-link:focus-visible { outline: 3px solid var(--accent, #2563eb); outline-offset: 2px; }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/cms-page/not-found/
git commit -m "feat(cms-page): add NotFoundPage component"
```

---

### Task D3: `CmsBlockHeader` (shared)

**Files:**
- Create: `src/app/cms/block-host/block-header/cms-block-header.ts`
- Create: `src/app/cms/block-host/block-header/cms-block-header.scss`

- [ ] **Step 1: Implement component**

```ts
// src/app/cms/block-host/block-header/cms-block-header.ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ComponentBase } from '../../../pages/state/cms.types';

@Component({
  selector: 'app-cms-block-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let b = block();
    @if (b.label || b.title || b.description) {
      <header class="block-header">
        @if (b.label) { <p class="label">{{ b.label }}</p> }
        @if (b.title) { <h2 class="title">{{ b.title }}</h2> }
        @if (b.description) { <p class="description">{{ b.description }}</p> }
      </header>
    }
  `,
  styleUrl: './cms-block-header.scss',
})
export class CmsBlockHeader {
  readonly block = input.required<ComponentBase>();
}
```

- [ ] **Step 2: Add styles**

```scss
// src/app/cms/block-host/block-header/cms-block-header.scss
.block-header {
  max-width: 60rem;
  margin: 0 auto 1.5rem;
  text-align: center;
}
.label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.875rem;
  color: var(--accent, #2563eb);
  margin: 0 0 0.5rem;
}
.title {
  font-size: 1.75rem;
  margin: 0 0 0.75rem;
  color: var(--fg);
}
.description {
  margin: 0;
  color: var(--fg);
  opacity: 0.85;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cms/block-host/block-header/
git commit -m "feat(cms): add shared CmsBlockHeader component"
```

---

### Task D4: `CmsFaqSkeleton`

**Files:**
- Create: `src/app/cms/components/faq/cms-faq.skeleton.ts`
- Create: `src/app/cms/components/faq/cms-faq.skeleton.scss`

- [ ] **Step 1: Implement skeleton**

```ts
// src/app/cms/components/faq/cms-faq.skeleton.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'cms-faq-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="row"></div>
    <div class="row"></div>
    <div class="row"></div>
  `,
  styleUrl: './cms-faq.skeleton.scss',
})
export class CmsFaqSkeleton {}
```

- [ ] **Step 2: Styles**

```scss
// src/app/cms/components/faq/cms-faq.skeleton.scss
:host {
  display: block;
  max-width: 50rem;
  margin: 2rem auto;
}
.row {
  height: 3rem;
  margin-bottom: 0.75rem;
  border-radius: 0.5rem;
  background: var(--surface, rgba(0,0,0,0.05));
  position: relative;
  overflow: hidden;
}
.row::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
  animation: shimmer 1.2s linear infinite;
}
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .row::after { animation: none; opacity: 0.4; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cms/components/faq/cms-faq.skeleton.ts src/app/cms/components/faq/cms-faq.skeleton.scss
git commit -m "feat(cms): add FAQ skeleton placeholder"
```

---

## Phase E — First component + first hero

### Task E1: `CmsFaq` component

**Files:**
- Create: `src/app/cms/components/faq/cms-faq.ts`
- Create: `src/app/cms/components/faq/cms-faq.scss`

- [ ] **Step 1: Implement CmsFaq**

```ts
// src/app/cms/components/faq/cms-faq.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentBase, FaqFields } from '../../../pages/state/cms.types';
import { CmsBlockHeader } from '../../block-host/block-header/cms-block-header';

type FaqBlock = ComponentBase & FaqFields & { kind: 'faq' };

@Component({
  selector: 'cms-faq',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CmsBlockHeader],
  template: `
    @let b = block();
    <section class="faq">
      <app-cms-block-header [block]="b" />
      <dl class="items">
        @for (item of b.items; track item.id) {
          <div class="item">
            <dt>{{ item.question }}</dt>
            <dd>{{ item.answer }}</dd>
          </div>
        }
      </dl>
      @if (b.cta; as cta) {
        <a class="cta" [href]="cta.href" [attr.data-variant]="cta.variant ?? 'primary'">{{ cta.label }}</a>
      }
    </section>
  `,
  styleUrl: './cms-faq.scss',
})
export class CmsFaq {
  readonly block = input.required<FaqBlock>();
}
```

- [ ] **Step 2: Styles**

```scss
// src/app/cms/components/faq/cms-faq.scss
:host { display: block; padding: 2rem 1.5rem; }
.faq  { max-width: 50rem; margin: 0 auto; color: var(--fg); }
.items { margin: 0; padding: 0; }
.item  { padding: 1rem 0; border-bottom: 1px solid var(--surface); }
.item:last-child { border-bottom: none; }
dt { font-weight: 600; margin: 0 0 0.5rem; }
dd { margin: 0; opacity: 0.9; }
.cta {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  background: var(--accent); color: #fff; text-decoration: none;
}
.cta:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cms/components/faq/cms-faq.ts src/app/cms/components/faq/cms-faq.scss
git commit -m "feat(cms): add CmsFaq component"
```

---

### Task E2: `CmsHeroText` component

**Files:**
- Create: `src/app/cms/hero/cms-hero-text.ts`
- Create: `src/app/cms/hero/cms-hero-text.scss`

- [ ] **Step 1: Implement component**

```ts
// src/app/cms/hero/cms-hero-text.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HeroBlock } from '../../pages/state/cms.types';

type TextHero = Extract<HeroBlock, { kind: 'text' }>;

@Component({
  selector: 'cms-hero-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let h = hero();
    <section class="hero">
      <h1>{{ h.title }}</h1>
      @if (h.description) { <p class="lead">{{ h.description }}</p> }
      @if (h.cta; as cta) {
        <a class="cta" [href]="cta.href" [attr.data-variant]="cta.variant ?? 'primary'">{{ cta.label }}</a>
      }
    </section>
  `,
  styleUrl: './cms-hero-text.scss',
})
export class CmsHeroText {
  readonly hero = input.required<TextHero>();
}
```

- [ ] **Step 2: Styles**

```scss
// src/app/cms/hero/cms-hero-text.scss
:host { display: block; background: var(--bg); color: var(--fg); }
.hero { max-width: 60rem; margin: 0 auto; padding: 5rem 1.5rem 3rem; text-align: center; }
h1    { font-size: clamp(2rem, 5vw, 3.5rem); margin: 0 0 1rem; }
.lead { font-size: 1.125rem; opacity: 0.9; margin: 0 0 2rem; }
.cta  {
  display: inline-block;
  padding: 0.9rem 1.75rem;
  border-radius: 0.5rem;
  background: var(--accent);
  color: #fff;
  text-decoration: none;
}
.cta:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cms/hero/cms-hero-text.ts src/app/cms/hero/cms-hero-text.scss
git commit -m "feat(cms): add CmsHeroText hero variant"
```

---

### Task E3: `CmsBlockHost` with FAQ case

**Files:**
- Create: `src/app/cms/block-host/cms-block-host.ts`
- Create: `src/app/cms/block-host/cms-block-host.scss`

- [ ] **Step 1: Implement CmsBlockHost**

```ts
// src/app/cms/block-host/cms-block-host.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentBlock } from '../../pages/state/cms.types';
import { CmsFaq } from '../components/faq/cms-faq';
import { CmsFaqSkeleton } from '../components/faq/cms-faq.skeleton';

@Component({
  selector: 'app-cms-block-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CmsFaq, CmsFaqSkeleton],
  template: `
    @switch (block().kind) {
      @case ('faq') {
        @defer (on viewport; prefetch on idle) {
          <cms-faq [block]="block()" />
        } @placeholder {
          <cms-faq-skeleton />
        }
      }
      @default {
        <!-- Unknown kind — render nothing rather than crashing.
             Add @case branches as new component types are introduced
             (see spec "Adding the 31st component type"). -->
      }
    }
  `,
  styleUrl: './cms-block-host.scss',
})
export class CmsBlockHost {
  readonly block = input.required<ComponentBlock>();
}
```

- [ ] **Step 2: Styles**

```scss
// src/app/cms/block-host/cms-block-host.scss
:host { display: block; }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cms/block-host/cms-block-host.ts src/app/cms/block-host/cms-block-host.scss
git commit -m "feat(cms): add CmsBlockHost registry with FAQ case"
```

---

## Phase F — CmsPage orchestrator

### Task F1: `CmsPage` component (no 404 handling yet)

**Files:**
- Create: `src/app/pages/cms-page/cms-page.ts`
- Create: `src/app/pages/cms-page/cms-page.html`
- Create: `src/app/pages/cms-page/cms-page.scss`

- [ ] **Step 1: Implement CmsPage**

```ts
// src/app/pages/cms-page/cms-page.ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MenuOverrideDirective } from '../../menu/menu-override.directive';
import { MenuOverride } from '../../menu/state/menu.types';
import { PageStore } from '../state/page.store';
import { CmsHeroText } from '../../cms/hero/cms-hero-text';
import { CmsBlockHost } from '../../cms/block-host/cms-block-host';
import { SeoSyncService } from '../../cms/seo/seo-sync.service';
import { PageWaiter } from './page-waiter/page-waiter';
import { NotFoundPage } from './not-found/not-found';

@Component({
  selector: 'app-cms-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CmsHeroText,
    CmsBlockHost,
    PageWaiter,
    NotFoundPage,
    MenuOverrideDirective,
  ],
  host: {
    '[attr.data-theme]': 'themeAttr()',
    '[class]': 'layoutClass()',
  },
  templateUrl: './cms-page.html',
  styleUrl: './cms-page.scss',
})
export class CmsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly seoSync = inject(SeoSyncService);
  protected readonly store = inject(PageStore);

  private readonly slug = toSignal(
    this.route.url.pipe(map(segs => '/' + segs.map(s => s.path).join('/'))),
    { initialValue: '/' },
  );

  protected readonly currentPage = this.store.currentPage;
  protected readonly isNotFound = this.store.isCurrentNotFound;

  protected readonly themeAttr = computed(() => this.currentPage()?.pageType ?? 'neutral');
  protected readonly layoutClass = computed(() =>
    this.currentPage() ? `page-${this.currentPage()!.pageType}` : 'page-waiting',
  );

  protected readonly menuOverride = computed<MenuOverride>(() => ({
    theme: this.themeForMenu(),
  }));
  private readonly themeForMenu = computed(() => {
    switch (this.currentPage()?.pageType) {
      case 'landing-dark':
      case 'landing-gradient':
        return 'dark';
      case 'landing-light':
      case 'article-light':
        return 'light';
      default:
        return undefined;
    }
  });

  constructor() {
    this.store.setCurrentSlug(this.slug);

    // Valid effect: syncing signal state → imperative Title/Meta/DOM APIs.
    effect(() => {
      const page = this.currentPage();
      if (!page) return;
      this.title.setTitle(page.seo.title);
      this.seoSync.applyMeta(page.seo);
      this.seoSync.applyJsonLd(page.seo.jsonLd);
    });
  }
}
```

- [ ] **Step 2: Template**

```html
<!-- src/app/pages/cms-page/cms-page.html -->
@if (isNotFound()) {
  <app-not-found />
} @else if (currentPage(); as page) {
  <div [menuOverride]="menuOverride()" menuOverrideKey="cms-page-theme">
    @switch (page.hero.kind) {
      @case ('text')  { <cms-hero-text  [hero]="page.hero" /> }
      <!-- image and video cases added in Phase I -->
    }
    @for (block of page.components; track block.id) {
      <app-cms-block-host [block]="block" />
    }
  </div>
} @else {
  <app-page-waiter />
}
```

- [ ] **Step 3: Base styles (neutral theme + page block)**

```scss
// src/app/pages/cms-page/cms-page.scss
:host {
  display: block;
  background: var(--bg, var(--shell-bg, #ffffff));
  color: var(--fg, var(--shell-fg, #111827));
  min-height: 60vh;
}

:host[data-theme="neutral"] {
  --bg: var(--shell-bg, #ffffff);
  --fg: var(--shell-fg, #111827);
  --accent: #2563eb;
  --surface: rgba(0,0,0,0.04);
}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/cms-page/cms-page.{ts,html,scss}
git commit -m "feat(cms-page): add CmsPage orchestrator (text hero + FAQ blocks)"
```

---

### Task F2: Set HTTP 404 status on the SSR response

**Files:**
- Modify: `src/app/pages/cms-page/cms-page.ts`

- [ ] **Step 1: Verify the `@angular/ssr` response token name**

Run: `node -e "console.log(Object.keys(require('@angular/ssr')))"`
Note the token used for response init/setting status (commonly `RESPONSE_INIT` in v21). If the symbol differs, substitute throughout this task.

- [ ] **Step 2: Add server-side status effect to CmsPage**

Add the following imports at the top of `cms-page.ts`:

```ts
import { PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { RESPONSE_INIT } from '@angular/ssr';
```

Inside `CmsPage`'s constructor, after the existing `effect(...)` for SEO, add:

```ts
if (isPlatformServer(inject(PLATFORM_ID))) {
  const response = inject(RESPONSE_INIT, { optional: true });
  effect(() => {
    if (this.isNotFound() && response) {
      response.status = 404;
      response.statusText = 'Not Found';
    }
  });
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build succeeds. If `RESPONSE_INIT` isn't exported in the installed `@angular/ssr` version, replace it with the correct token (e.g. `REQUEST_CONTEXT` or `Response`) — see spec "Open questions for implementation".

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/cms-page/cms-page.ts
git commit -m "feat(cms-page): set HTTP 404 status on SSR response for missing slugs"
```

---

### Task F3: Switch routing to catch-all CMS route

**Files:**
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Replace routes**

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '**',
    loadComponent: () =>
      import('./pages/cms-page/cms-page').then((m) => m.CmsPage),
  },
];
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build succeeds. Existing static page components (`home`, `article`, `search`, `checkout`) are now unreferenced — they are removed in Phase L.

- [ ] **Step 3: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat(routes): replace static page routes with CMS catch-all"
```

---

## Phase G — Loading UX components

### Task G1: `RouteProgress` global top bar

**Files:**
- Create: `src/app/shell/route-progress/route-progress.ts`
- Create: `src/app/shell/route-progress/route-progress.scss`

- [ ] **Step 1: Implement component**

```ts
// src/app/shell/route-progress/route-progress.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-route-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    '[attr.aria-hidden]': 'isActive() ? null : "true"',
    '[attr.aria-busy]': 'isActive() ? "true" : null',
    '[class.is-active]': 'isActive()',
  },
  template: `<div class="bar"></div>`,
  styleUrl: './route-progress.scss',
})
export class RouteProgress {
  private readonly router = inject(Router);
  private readonly events = toSignal(this.router.events, { initialValue: null });

  protected readonly isActive = computed(() => {
    const e = this.events();
    if (e instanceof NavigationStart) return true;
    if (
      e instanceof NavigationEnd ||
      e instanceof NavigationCancel ||
      e instanceof NavigationError
    ) {
      return false;
    }
    return false;
  });
}
```

- [ ] **Step 2: Styles**

```scss
// src/app/shell/route-progress/route-progress.scss
:host {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 3px;
  pointer-events: none;
  z-index: 9999;
}
.bar {
  height: 100%;
  width: 0;
  background: var(--accent, #2563eb);
  transition: width 200ms ease-out, opacity 200ms ease-out;
  opacity: 0;
}
:host.is-active .bar {
  width: 70%;
  opacity: 1;
  animation: progress 1.2s ease-in-out infinite;
}
@keyframes progress {
  0%   { width: 5%;  }
  50%  { width: 70%; }
  100% { width: 95%; }
}
@media (prefers-reduced-motion: reduce) {
  .bar { transition: none; animation: none; }
  :host.is-active .bar { width: 100%; animation: none; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/shell/route-progress/
git commit -m "feat(shell): add RouteProgress global top bar"
```

---

### Task G2: Skip link, RouteFocus directive, app shell update

**Files:**
- Create: `src/app/shell/skip-link/skip-link.ts`
- Create: `src/app/shell/skip-link/skip-link.scss`
- Create: `src/app/shell/route-focus.directive.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/app.ts`

- [ ] **Step 1: Skip link component**

```ts
// src/app/shell/skip-link/skip-link.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-skip-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a href="#main-content" class="skip">Skip to main content</a>`,
  styleUrl: './skip-link.scss',
})
export class SkipLink {}
```

- [ ] **Step 2: Skip link styles**

```scss
// src/app/shell/skip-link/skip-link.scss
.skip {
  position: absolute;
  top: -40px; left: 0;
  background: #000; color: #fff;
  padding: 0.5rem 1rem;
  z-index: 10000;
  text-decoration: none;
}
.skip:focus { top: 0; }
```

- [ ] **Step 3: RouteFocus directive**

```ts
// src/app/shell/route-focus.directive.ts
import { Directive, ElementRef, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Directive({ selector: '[appRouteFocus]' })
export class RouteFocusDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly events = toSignal(this.router.events, { initialValue: null });

  constructor() {
    // Valid effect: signal state → imperative DOM focus API.
    effect(() => {
      if (this.events() instanceof NavigationEnd) {
        this.el.nativeElement.focus({ preventScroll: false });
      }
    });
  }
}
```

- [ ] **Step 4: Update app shell template**

```html
<!-- src/app/app.html -->
<app-skip-link />
<app-route-progress />
<app-main-menu />
<main
  id="main-content"
  tabindex="-1"
  appRouteFocus
  style="outline: none;"
>
  <router-outlet />
</main>
<app-footer />
```

- [ ] **Step 5: Update app.ts imports**

```ts
// src/app/app.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MainMenu } from './menu/main-menu/main-menu';
import { AppFooter } from './footer/footer';
import { RouteProgress } from './shell/route-progress/route-progress';
import { SkipLink } from './shell/skip-link/skip-link';
import { RouteFocusDirective } from './shell/route-focus.directive';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    MainMenu,
    AppFooter,
    RouteProgress,
    SkipLink,
    RouteFocusDirective,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
```

- [ ] **Step 6: AppFooter placeholder**

Create a minimal AppFooter so the shell builds (full implementation in Task L1 / when CMS schema is wired):

```ts
// src/app/footer/footer.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FooterStore } from './state/footer.store';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'contentinfo' },
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class AppFooter {
  protected readonly store = inject(FooterStore);
}
```

```html
<!-- src/app/footer/footer.html -->
<footer class="footer">
  <div class="cols">
    @for (col of store.columns(); track col.id) {
      <section>
        <h3>{{ col.title }}</h3>
        <ul>
          @for (link of col.links; track link.id) {
            <li><a [href]="link.href">{{ link.label }}</a></li>
          }
        </ul>
      </section>
    }
  </div>
  @if (store.legal(); as l) {
    <div class="legal">
      <p>{{ l.copyright }}</p>
      <ul>
        @for (link of l.links; track link.id) {
          <li><a [href]="link.href">{{ link.label }}</a></li>
        }
      </ul>
    </div>
  }
</footer>
```

```scss
// src/app/footer/footer.scss
:host { display: block; background: var(--bg); color: var(--fg); padding: 2rem 1.5rem; }
.cols { display: grid; gap: 2rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); max-width: 80rem; margin: 0 auto; }
h3 { margin: 0 0 0.5rem; font-size: 1rem; }
ul { list-style: none; padding: 0; margin: 0; }
li { padding: 0.25rem 0; }
a  { color: inherit; text-decoration: none; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.legal { max-width: 80rem; margin: 2rem auto 0; opacity: 0.85; font-size: 0.875rem; }
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/app/shell/ src/app/footer/footer.{ts,html,scss} src/app/app.html src/app/app.ts
git commit -m "feat(shell): add skip link, RouteFocus, AppFooter; wire RouteProgress into app shell"
```

---

## Phase H — Theming

### Task H1: Add CSS variables per pageType

**Files:**
- Modify: `src/app/pages/cms-page/cms-page.scss`
- Modify: `src/styles.scss` (define shell tokens)

- [ ] **Step 1: Add shell tokens to global styles**

Append to `src/styles.scss`:

```scss
// Shell-level CSS variables (used when no page theme is active — Phase 1 waiter).
:root {
  --shell-bg: #ffffff;
  --shell-fg: #111827;
}
```

- [ ] **Step 2: Replace cms-page.scss with full theme set**

```scss
// src/app/pages/cms-page/cms-page.scss
:host {
  display: block;
  background: var(--bg);
  color: var(--fg);
  min-height: 60vh;
}

// Phase-1 waiter (no page payload yet)
:host[data-theme="neutral"] {
  --bg: var(--shell-bg, #ffffff);
  --fg: var(--shell-fg, #111827);
  --accent: #2563eb;
  --surface: rgba(0,0,0,0.04);
}

:host[data-theme="landing-light"],
:host[data-theme="article-light"] {
  --bg: #ffffff;
  --fg: #111827;
  --accent: #2563eb;
  --surface: #f9fafb;
}

:host[data-theme="landing-dark"],
:host[data-theme="article-dark"] {
  --bg: #0f172a;
  --fg: #e5e7eb;
  --accent: #60a5fa;
  --surface: #1e293b;
}

:host[data-theme="landing-gradient"] {
  --bg: linear-gradient(135deg, #4338ca 0%, #ec4899 100%);
  --fg: #ffffff;
  --accent: #fbbf24;
  --surface: rgba(255, 255, 255, 0.08);
}

// Gradient pages need a scrim/surface backdrop behind text-heavy components
// so contrast holds across the gradient.
:host[data-theme="landing-gradient"] app-cms-block-host {
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(2px);
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/styles.scss src/app/pages/cms-page/cms-page.scss
git commit -m "feat(theming): add CSS variables per pageType (light/dark/gradient/neutral)"
```

---

## Phase I — Remaining hero variants

### Task I1: `CmsHeroImage` (NgOptimizedImage)

**Files:**
- Create: `src/app/cms/hero/cms-hero-image.ts`
- Create: `src/app/cms/hero/cms-hero-image.scss`
- Modify: `src/app/pages/cms-page/cms-page.html`
- Modify: `src/app/pages/cms-page/cms-page.ts`

- [ ] **Step 1: Implement component**

```ts
// src/app/cms/hero/cms-hero-image.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { HeroBlock } from '../../pages/state/cms.types';

type ImageHero = Extract<HeroBlock, { kind: 'image' }>;

@Component({
  selector: 'cms-hero-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  template: `
    @let h = hero();
    <section class="hero">
      <div class="image">
        <img
          [ngSrc]="h.image.src"
          [width]="h.image.width"
          [height]="h.image.height"
          [alt]="h.image.decorative ? '' : h.image.alt"
          priority
          fetchpriority="high"
        />
      </div>
      <div class="copy">
        <h1>{{ h.title }}</h1>
        @if (h.description) { <p class="lead">{{ h.description }}</p> }
        @if (h.cta; as cta) {
          <a class="cta" [href]="cta.href" [attr.data-variant]="cta.variant ?? 'primary'">{{ cta.label }}</a>
        }
      </div>
    </section>
  `,
  styleUrl: './cms-hero-image.scss',
})
export class CmsHeroImage {
  readonly hero = input.required<ImageHero>();
}
```

- [ ] **Step 2: Styles**

```scss
// src/app/cms/hero/cms-hero-image.scss
:host { display: block; background: var(--bg); color: var(--fg); }
.hero {
  display: grid;
  gap: 2rem;
  align-items: center;
  max-width: 80rem;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  grid-template-columns: 1fr;
}
@media (min-width: 60rem) {
  .hero { grid-template-columns: 1fr 1fr; }
}
.image img { width: 100%; height: auto; border-radius: 0.75rem; }
h1   { font-size: clamp(2rem, 4vw, 3rem); margin: 0 0 1rem; }
.lead { font-size: 1.125rem; opacity: 0.9; margin: 0 0 2rem; }
.cta {
  display: inline-block;
  padding: 0.9rem 1.75rem;
  border-radius: 0.5rem;
  background: var(--accent);
  color: #fff; text-decoration: none;
}
.cta:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 3: Wire into CmsPage template**

In `cms-page.html`, replace the hero `@switch` with:

```html
@switch (page.hero.kind) {
  @case ('text')  { <cms-hero-text  [hero]="page.hero" /> }
  @case ('image') { <cms-hero-image [hero]="page.hero" /> }
}
```

In `cms-page.ts`, add `CmsHeroImage` to imports:

```ts
import { CmsHeroImage } from '../../cms/hero/cms-hero-image';
// ... and add CmsHeroImage to the imports array
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/cms/hero/cms-hero-image.{ts,scss} src/app/pages/cms-page/cms-page.{ts,html}
git commit -m "feat(cms): add CmsHeroImage hero variant"
```

---

### Task I2: `CmsHeroVideo`

**Files:**
- Create: `src/app/cms/hero/cms-hero-video.ts`
- Create: `src/app/cms/hero/cms-hero-video.scss`
- Modify: `src/app/pages/cms-page/cms-page.html`
- Modify: `src/app/pages/cms-page/cms-page.ts`

- [ ] **Step 1: Implement component**

```ts
// src/app/cms/hero/cms-hero-video.ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HeroBlock } from '../../pages/state/cms.types';

type VideoHero = Extract<HeroBlock, { kind: 'video' }>;

@Component({
  selector: 'cms-hero-video',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let h = hero();
    <section class="hero">
      <div class="media">
        <video
          [poster]="h.poster?.src ?? null"
          [src]="h.video.src"
          controls
          preload="metadata"
          playsinline
          [muted]="autoMuted()"
          [autoplay]="autoplay()"
        ></video>
      </div>
      <div class="copy">
        <h1>{{ h.title }}</h1>
        @if (h.description) { <p class="lead">{{ h.description }}</p> }
        @if (h.cta; as cta) {
          <a class="cta" [href]="cta.href" [attr.data-variant]="cta.variant ?? 'primary'">{{ cta.label }}</a>
        }
      </div>
    </section>
  `,
  styleUrl: './cms-hero-video.scss',
})
export class CmsHeroVideo {
  readonly hero = input.required<VideoHero>();
  protected readonly autoplay = computed(() => this.prefersMotion());
  protected readonly autoMuted = computed(() => this.prefersMotion());

  private prefersMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
```

- [ ] **Step 2: Styles**

```scss
// src/app/cms/hero/cms-hero-video.scss
:host { display: block; background: var(--bg); color: var(--fg); }
.hero {
  max-width: 80rem;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  display: grid;
  gap: 2rem;
  grid-template-columns: 1fr;
}
.media video {
  width: 100%; height: auto;
  border-radius: 0.75rem;
  background: #000;
}
.copy { max-width: 50rem; }
h1   { font-size: clamp(2rem, 4vw, 3rem); margin: 0 0 1rem; }
.lead { font-size: 1.125rem; opacity: 0.9; margin: 0 0 2rem; }
.cta {
  display: inline-block;
  padding: 0.9rem 1.75rem;
  border-radius: 0.5rem;
  background: var(--accent); color: #fff;
  text-decoration: none;
}
.cta:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 3: Wire into CmsPage template**

Update `cms-page.html`:

```html
@switch (page.hero.kind) {
  @case ('text')  { <cms-hero-text  [hero]="page.hero" /> }
  @case ('image') { <cms-hero-image [hero]="page.hero" /> }
  @case ('video') { <cms-hero-video [hero]="page.hero" /> }
}
```

Add to `cms-page.ts` imports:

```ts
import { CmsHeroVideo } from '../../cms/hero/cms-hero-video';
// add CmsHeroVideo to the imports array
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/cms/hero/cms-hero-video.{ts,scss} src/app/pages/cms-page/cms-page.{ts,html}
git commit -m "feat(cms): add CmsHeroVideo hero variant"
```

---

## Phase J — Second component type (image-text)

### Task J1: `CmsImageText` + skeleton + register in BlockHost

**Files:**
- Create: `src/app/cms/components/image-text/cms-image-text.ts`
- Create: `src/app/cms/components/image-text/cms-image-text.scss`
- Create: `src/app/cms/components/image-text/cms-image-text.skeleton.ts`
- Create: `src/app/cms/components/image-text/cms-image-text.skeleton.scss`
- Modify: `src/app/cms/block-host/cms-block-host.ts`

- [ ] **Step 1: Implement CmsImageText**

```ts
// src/app/cms/components/image-text/cms-image-text.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ComponentBase, ImageTextFields } from '../../../pages/state/cms.types';
import { CmsBlockHeader } from '../../block-host/block-header/cms-block-header';

type ImageTextBlock = ComponentBase & ImageTextFields & { kind: 'image-text' };

@Component({
  selector: 'cms-image-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, CmsBlockHeader],
  host: { '[attr.data-layout]': 'block().layout ?? "image-left"' },
  template: `
    @let b = block();
    <section class="image-text">
      <div class="image">
        <img
          [ngSrc]="b.image.src"
          [width]="b.image.width"
          [height]="b.image.height"
          [alt]="b.image.decorative ? '' : b.image.alt"
          loading="lazy"
        />
      </div>
      <div class="copy">
        <app-cms-block-header [block]="b" />
        <div class="body">{{ b.body }}</div>
        @if (b.cta; as cta) {
          <a class="cta" [href]="cta.href" [attr.data-variant]="cta.variant ?? 'primary'">{{ cta.label }}</a>
        }
      </div>
    </section>
  `,
  styleUrl: './cms-image-text.scss',
})
export class CmsImageText {
  readonly block = input.required<ImageTextBlock>();
}
```

- [ ] **Step 2: Component styles**

```scss
// src/app/cms/components/image-text/cms-image-text.scss
:host { display: block; padding: 2rem 1.5rem; }
.image-text {
  display: grid;
  gap: 2rem;
  max-width: 70rem;
  margin: 0 auto;
  grid-template-columns: 1fr;
  align-items: center;
}
@media (min-width: 50rem) {
  .image-text { grid-template-columns: 1fr 1fr; }
  :host[data-layout="image-right"] .image-text { direction: rtl; }
  :host[data-layout="image-right"] .image-text > * { direction: ltr; }
}
.image img { width: 100%; height: auto; border-radius: 0.75rem; }
.body { white-space: pre-wrap; color: var(--fg); }
.cta {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  background: var(--accent); color: #fff; text-decoration: none;
}
.cta:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 3: Skeleton**

```ts
// src/app/cms/components/image-text/cms-image-text.skeleton.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'cms-image-text-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="row">
      <div class="image-ph"></div>
      <div class="copy-ph">
        <div class="line short"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line short"></div>
      </div>
    </div>
  `,
  styleUrl: './cms-image-text.skeleton.scss',
})
export class CmsImageTextSkeleton {}
```

```scss
// src/app/cms/components/image-text/cms-image-text.skeleton.scss
:host { display: block; padding: 2rem 1.5rem; }
.row {
  display: grid; gap: 2rem;
  max-width: 70rem; margin: 0 auto;
  grid-template-columns: 1fr;
}
@media (min-width: 50rem) { .row { grid-template-columns: 1fr 1fr; } }
.image-ph { aspect-ratio: 4 / 3; background: var(--surface, rgba(0,0,0,0.05)); border-radius: 0.75rem; }
.copy-ph { display: grid; gap: 0.75rem; align-content: center; }
.line { height: 1rem; background: var(--surface, rgba(0,0,0,0.05)); border-radius: 0.25rem; }
.line.short { width: 60%; }
@media (prefers-reduced-motion: reduce) {
  .image-ph, .line { opacity: 0.6; }
}
```

- [ ] **Step 4: Register in CmsBlockHost**

Update `cms-block-host.ts`:

```ts
// src/app/cms/block-host/cms-block-host.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentBlock } from '../../pages/state/cms.types';
import { CmsFaq } from '../components/faq/cms-faq';
import { CmsFaqSkeleton } from '../components/faq/cms-faq.skeleton';
import { CmsImageText } from '../components/image-text/cms-image-text';
import { CmsImageTextSkeleton } from '../components/image-text/cms-image-text.skeleton';

@Component({
  selector: 'app-cms-block-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CmsFaq, CmsFaqSkeleton, CmsImageText, CmsImageTextSkeleton],
  template: `
    @switch (block().kind) {
      @case ('faq') {
        @defer (on viewport; prefetch on idle) {
          <cms-faq [block]="block()" />
        } @placeholder {
          <cms-faq-skeleton />
        }
      }
      @case ('image-text') {
        @defer (on viewport; prefetch on idle) {
          <cms-image-text [block]="block()" />
        } @placeholder {
          <cms-image-text-skeleton />
        }
      }
      @default {}
    }
  `,
  styleUrl: './cms-block-host.scss',
})
export class CmsBlockHost {
  readonly block = input.required<ComponentBlock>();
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/cms/components/image-text/ src/app/cms/block-host/cms-block-host.ts
git commit -m "feat(cms): add CmsImageText component + skeleton, register in BlockHost"
```

---

## Phase K — Server endpoints + edge cache headers

### Task K1: Edge cache headers in server.ts

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Read existing server.ts**

Open the existing `server.ts` to understand the bootstrap pattern. The hand-off point for response headers is just after Angular's `commonEngine.render(...)` call (the variable name may differ between Angular versions — the relevant spot is where the rendered HTML is written to the response).

- [ ] **Step 2: Add cache headers around the render call**

Wrap the render handler so that after Angular renders, the response has cache headers set based on its status. Insert this logic immediately before the response is sent:

```ts
// Inside the catch-all SSR handler in server.ts, after Angular has rendered
// the page and right before res.send/res.end:
if (res.statusCode === 200) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
} else if (res.statusCode === 404) {
  res.setHeader('Cache-Control', 'public, s-maxage=10');
}
res.setHeader('Vary', 'Accept-Encoding');
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add server.ts
git commit -m "feat(server): set Cache-Control headers based on response status"
```

---

### Task K2: Sitemap.xml endpoint

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Add sitemap route**

Inside `server.ts`, register a sitemap route *before* the Angular catch-all SSR handler:

```ts
// Sitemap — proxies the CMS sitemap list and emits XML.
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const upstream = await fetch(`${process.env.CMS_BASE_URL ?? ''}/api/sitemap`);
    if (!upstream.ok) {
      res.status(502).type('text/plain').send('Bad upstream');
      return;
    }
    const entries: { slug: string; lastmod?: string; priority?: number }[] = await upstream.json();
    const origin = `${_req.protocol}://${_req.get('host')}`;
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      entries
        .map((e) => {
          const loc = `${origin}${e.slug}`;
          const lastmod = e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : '';
          const prio = e.priority != null ? `<priority>${e.priority}</priority>` : '';
          return `  <url><loc>${loc}</loc>${lastmod}${prio}</url>`;
        })
        .join('\n') +
      `\n</urlset>\n`;
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.type('application/xml').send(xml);
  } catch {
    res.status(500).type('text/plain').send('Failed to build sitemap');
  }
});
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat(server): add /sitemap.xml endpoint"
```

---

### Task K3: Robots.txt endpoint

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Add robots route**

Inside `server.ts`, before the Angular catch-all SSR handler:

```ts
app.get('/robots.txt', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  const disallow = process.env.ROBOTS_DISALLOW_ALL === 'true' ? 'Disallow: /\n' : '';
  res.setHeader('Cache-Control', 'public, s-maxage=300');
  res.type('text/plain').send(
    `User-agent: *\n${disallow}Sitemap: ${origin}/sitemap.xml\n`,
  );
});
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat(server): add /robots.txt endpoint"
```

---

## Phase L — Migration

### Task L1: Remove obsolete page components

**Files:**
- Delete: `src/app/pages/home/`
- Delete: `src/app/pages/article/`
- Delete: `src/app/pages/search/`
- Delete: `src/app/pages/checkout/`
- Modify: `src/app/app.routes.server.ts`

- [ ] **Step 1: Delete old page directories**

Run:

```bash
rm -rf src/app/pages/home src/app/pages/article src/app/pages/search src/app/pages/checkout
```

- [ ] **Step 2: Trim app.routes.server.ts**

```ts
// src/app/app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds. If anything still references the removed components, fix the import.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/pages/ src/app/app.routes.server.ts
git commit -m "refactor: remove static page components in favor of catch-all CMS page"
```

---

## Phase M — Integration smoke + a11y check

### Task M1: End-to-end smoke (manual) + axe check

**Files:** none changed; this is a verification task.

- [ ] **Step 1: Start the SSR app**

Run:
```bash
npm run build && node dist/menu-store-poc/server/server.mjs
```
Expected: server starts on the default port.

- [ ] **Step 2: Curl a known slug and inspect SSR HTML**

Run:
```bash
curl -s http://localhost:4000/some-slug | head -80
```

Expected: the response contains the page title, hero text, and at least one component's content directly in the HTML (no "Loading…" for in-viewport blocks). Set up a fixture slug in the CMS so this returns deterministic content.

- [ ] **Step 3: Curl an unknown slug and check status code**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/nope-not-real
```
Expected: `404`.

- [ ] **Step 4: Run AXE against a rendered page**

Install axe-cli locally if not already present:

```bash
npm install --save-dev @axe-core/cli
```

Then:

```bash
npx axe http://localhost:4000/some-slug --exit
```

Expected: 0 violations. Fix any contrast / role / labelling issues before merging.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all unit/integration tests pass.

- [ ] **Step 6: Commit (axe dev-dep only)**

```bash
git add package.json package-lock.json
git commit -m "chore(test): add @axe-core/cli for accessibility smoke"
```

---

## What's NOT covered in this plan (intentional)

These items from the spec are deferred to follow-up plans:

- **Additional component types (table, cta-card, content-list, video, ...).** Follow the recipe in the spec: define types in `cms.types.ts`, create `cms-<kind>.{ts,scss}` + optional skeleton, add a `@case ('<kind>')` branch in `CmsBlockHost`. Each new type takes ~1 task following the Phase J template.
- **Webhook-driven cache invalidation.** Server cache interceptor seam is ready; add a `POST /__cache/bust` endpoint in a follow-up.
- **Per-page footer override.** Use the existing CSS-variable cascade until a concrete override need appears.
- **LRU bound on PageStore cache.** Defer until memory pressure is observed.
- **i18n / multi-locale.**
- **Service worker / offline support.**

## Recipe — adding the next component type (e.g. `table`)

1. **Types.** In `cms.types.ts`, add `TableFields` and extend the `ComponentBlock` union with `({ kind: 'table' } & ComponentBase & TableFields)`.
2. **Component.** Create `src/app/cms/components/table/cms-table.{ts,scss}` mirroring `CmsImageText` (Phase J Task J1, Steps 1–2). Use `<table>` semantic markup, `<thead>`/`<tbody>`, captioned via `aria-labelledby` referencing the block header.
3. **Skeleton.** Create `cms-table.skeleton.{ts,scss}` mirroring `CmsImageTextSkeleton` (Step 3).
4. **Register.** In `cms-block-host.ts`, add the imports and a new `@case ('table')` `@defer`/`@placeholder` branch.
5. **Test.** Add a unit test verifying the component renders rows + header from a `TableFields` fixture and meets a11y rules (axe runs on the rendered fixture).
6. **Commit.**

---

## Self-review summary

Spec coverage map (each spec section → task that implements it):

- **Architecture / two-phase loading** → F1 (CmsPage), G1 (RouteProgress), D1 (PageWaiter)
- **Data contract** → A2 (cms.types.ts)
- **PageStore** → C2
- **FooterStore** → C1
- **Routing + 404** → F2, F3
- **CmsPage** → F1
- **CmsBlockHost + 30-type scale** → E3 + J1 (pattern)
- **Theming** → H1 + F1 (data-theme attr)
- **SEO / JSON-LD** → C3 (SeoSyncService) + F1 (effect that calls it)
- **Sitemap + robots** → K2, K3
- **Loading UX (RouteProgress, PageWaiter, skeletons)** → G1, D1, D4
- **Accessibility** → G2 (skip link + focus) + per-component a11y baked into D/E/I/J tasks + M1 axe
- **Server cache + edge headers** → B1, B2, B3, K1
- **Config changes** → A1 (`withIncrementalHydration` etc.), B3 (interceptor)
- **Migration** → L1
- **Testing strategy** → B1/B2/C1/C2/C3 unit tests + M1 integration smoke

No spec section left without a task. Type names (`CmsPage`, `HeroBlock`, `ComponentBlock`, `SeoData`, `PageStore`, `FooterStore`, `CmsBlockHost`, `CmsBlockHeader`, `SeoSyncService`, `PageWaiter`, `NotFoundPage`, `RouteProgress`, `RouteFocusDirective`, `SkipLink`, `AppFooter`, `CmsHeroText`/`Image`/`Video`, `CmsFaq`/`Skeleton`, `CmsImageText`/`Skeleton`) are consistent throughout. No placeholders or "TBD" steps remain.
