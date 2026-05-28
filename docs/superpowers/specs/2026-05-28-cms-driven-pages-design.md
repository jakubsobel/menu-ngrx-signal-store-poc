# CMS-Driven Dynamic Pages — Design Spec

**Date:** 2026-05-28
**Status:** Draft, pending implementation plan

## Goals

Build a fully SSR-rendered Angular 21 app where pages are entirely CMS-driven: editors create slugs and page content at runtime, the app fetches them on demand, and crawlers (search engines and LLM bots) receive complete HTML with no client-side data loading required for first paint.

Specific requirements:

- **SSR-first.** Every request returns fully rendered HTML, including dynamic component content. No "loading..." placeholders in the HTML sent to bots.
- **Fast and lightweight.** Minimal initial bundle; lazy chunks for components that aren't on the current page.
- **Two-phase client navigation UX.** Click a `routerLink` → instant top progress bar + full-area page waiter → real page renders with theme/hero/components.
- **WCAG 2.2 AA.** Focus management, color contrast, ARIA roles, reduced motion, keyboard navigation, axe-clean.
- **Signal-based.** Use `httpResource`, `linkedSignal`, `computed`, `signalMethod` — no `.subscribe()` in component or store code, no RxJS pipelines unless a specific feature (e.g. operator semantics) demands it.
- **No `effect()` for state propagation between signals.** Reserve `effect()` for syncing to imperative, non-signal APIs (Title/Meta services, DOM scripts).

## Scope

In scope:

- Single catch-all route renders any CMS slug.
- Global `MenuStore`, `FooterStore`, and root-scoped `PageStore` with a persistent slug-keyed cache for back-navigation.
- A registry of up to ~30 CMS component types, each rendered via `@defer (on viewport; prefetch on idle)` with a per-type skeleton.
- Three hero variants (text / image / video), eagerly loaded.
- Five+ page themes (`landing-light`, `landing-dark`, `landing-gradient`, `article-light`, `article-dark`, extensible) driven by a `pageType` discriminator and CSS custom properties.
- SEO meta tags + JSON-LD applied per page.
- Sitemap.xml and robots.txt endpoints.
- Server-side TTL cache (HTTP interceptor) + edge `Cache-Control` headers.
- Real HTTP 404 for unknown slugs.

Explicitly out of scope (v1):

- Webhook-driven cache invalidation (TTL only for now; interceptor seam makes webhook addition trivial later).
- i18n / multi-locale.
- Per-user personalization.
- Footer per-page override directive (use CSS-variable cascade until a concrete override need appears).
- LRU bound on PageStore cache.
- Service worker / offline support.

## Architecture

### Two-phase loading model

```
SSR (first load / bot / refresh)
  Browser/Bot → GET /some/slug
    → Node SSR (Angular)
      → catch-all ** route → CmsPage
        → MenuStore + FooterStore + PageStore httpResource
          → HTTP interceptor (server cache, TTL 60s page / 300s menu+footer)
            → CMS endpoints /api/menu, /api/footer, /api/page/:slug
        → render HTML (hero + all components, fully expanded via withIncrementalHydration)
      → Response 200 (or 404) + TransferState
        + Cache-Control: public, s-maxage=60, stale-while-revalidate=600

Client-side navigation
  Click [routerLink="/foo"]
    → RouteProgress top bar shows instantly
    → CmsPage activates; PageStore httpResource refetches via signalMethod-set slug
    → Phase 1: PageWaiter (full-area neutral surface, brand mark)
    → /api/page/:slug arrives → page type known
    → Phase 2: theme applied, hero renders eagerly, components render with per-type
      @defer skeletons until each block hydrates (on viewport)
    → RouteProgress hides
```

### Layers

- **CmsServerCache + cmsCacheInterceptor** — server-only TTL cache wired as an `HttpInterceptorFn`; transparent to stores.
- **MenuStore, FooterStore** (`providedIn: 'root'`) — both use `httpResource`, both TransferState-seeded. Mirror the existing `MenuStore` shape.
- **PageStore** (`providedIn: 'root'`) — slug-keyed page cache built from `httpResource` + `linkedSignal` accumulator. Caches both successful pages and 404 slugs for the session.
- **Routing** — single catch-all `**` → `CmsPage`. SSR mode `RenderMode.Server` for all paths. 404 detected via `httpResource.statusCode()`; HTTP status set on the SSR Response.
- **CmsPage** — orchestrates: keys store on the URL slug, renders waiter / NotFound / hero+components based on store state, applies SEO via an effect on `currentPage()`, pushes a theme override into MenuStore for the duration of the page.
- **CmsBlockHost** — internal registry: one `@switch (block.kind)` over the union, each `@case` an `@defer (on viewport; prefetch on idle)` with the matching component and per-type skeleton placeholder.
- **RouteProgress** — global top bar, listens to `router.events` via `toSignal`.

### `withIncrementalHydration()` is mandatory

Without it, `@defer` blocks render only their placeholders on the server. Bots and LLMs would see "Loading…" skeletons instead of real content. With `provideClientHydration(withEventReplay(), withIncrementalHydration())`, the server fully renders every `@defer` block and the client hydrates each one when its trigger fires.

## Data contract

```ts
// Top-level response from GET /api/page/:slug
export interface CmsPage {
  slug: string;
  pageType: PageType;            // discriminator → theme + layout
  seo: SeoData;
  hero: HeroBlock;                // always present (non-nullable per editorial guarantee)
  components: ComponentBlock[];   // ordered, rendered top-to-bottom
}

export type PageType =
  | 'landing-light'
  | 'landing-dark'
  | 'landing-gradient'
  | 'article-light'
  | 'article-dark';
  // Extensible: add new values + matching CSS block. No code change required elsewhere.

export interface SeoData {
  title: string;
  description: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;             // absolute URL preferred
  twitterCard?: 'summary' | 'summary_large_image';
  jsonLd?: object | object[];   // emitted as <script type="application/ld+json">
}

// Hero — discriminated union by kind, drives which hero component renders
export type HeroBlock =
  | { kind: 'text';  title: string; description?: string; cta?: Cta }
  | { kind: 'image'; title: string; description?: string; image: ImageRef; cta?: Cta }
  | { kind: 'video'; title: string; description?: string; video: VideoRef; poster?: ImageRef; cta?: Cta };

// Common base fields shared by every component
export interface ComponentBase {
  id: string;            // stable id for @for track + a11y anchors
  label?: string;
  title?: string;
  description?: string;
  cta?: Cta;
}

// Discriminated union across all component types
export type ComponentBlock =
  | ({ kind: 'faq' }          & ComponentBase & FaqFields)
  | ({ kind: 'table' }        & ComponentBase & TableFields)
  | ({ kind: 'image-text' }   & ComponentBase & ImageTextFields)
  | ({ kind: 'cta-card' }     & ComponentBase & CtaCardFields)
  | ({ kind: 'content-list' } & ComponentBase & ContentListFields)
  | ({ kind: 'video' }        & ComponentBase & VideoBlockFields);
  // ... up to ~30 kinds

export interface Cta      { label: string; href: string; variant?: 'primary' | 'secondary' | 'link' }
export interface ImageRef { src: string; alt: string; width: number; height: number; decorative?: boolean }
export interface VideoRef { src: string; type: 'mp4' | 'webm' | 'youtube' | 'vimeo'; captionsSrc?: string }
```

`pageType` is the **single discriminator** for theme + layout. Applied as a `data-theme="..."` attribute on the `CmsPage` host. Avoids `style` bindings entirely (CSS owns presentation).

`hero.kind` is **separate** from `pageType` — a `landing-gradient` page can have a `text` or `image` or `video` hero. Two orthogonal concerns.

## PageStore

Signal-only design. `httpResource` fetches the current slug; `linkedSignal` accumulates results into a slug-keyed cache; `signalMethod` triggers slug updates from the route.

```ts
// state/page.types.ts
export interface PageState {
  currentSlug: string | null;
}

interface CachePayload {
  pages: Record<string, CmsPage>;
  notFoundSlugs: string[];
}

const PAGES_STATE_KEY = makeStateKey<CachePayload>('page.cache');

// state/page.store.ts
export const PageStore = signalStore(
  { providedIn: 'root' },

  withState<PageState>({ currentSlug: null }),

  withProps((store) => {
    const pageResource = httpResource<CmsPage>(() => {
      const slug = store.currentSlug();
      return slug ? `/api/page/${encodeURIComponent(slug)}` : undefined;
    });

    // Accumulating cache — pure signal pipeline.
    const pageMap = linkedSignal<Record<string, CmsPage>>({
      source: () => pageResource.hasValue() ? pageResource.value() : null,
      computation: (newPage, previous) => {
        const prevMap = previous?.value ?? {};
        if (!newPage) return prevMap;
        return { ...prevMap, [newPage.slug]: newPage };
      },
    });

    // 404 accumulator — same pattern, source includes slug+status.
    const notFoundSlugs = linkedSignal<ReadonlySet<string>>({
      source: () => ({ slug: store.currentSlug(), status: pageResource.statusCode?.() }),
      computation: ({ slug, status }, previous) => {
        const prev = previous?.value ?? new Set<string>();
        if (status === 404 && slug && !prev.has(slug)) {
          const next = new Set(prev); next.add(slug); return next;
        }
        return prev;
      },
    });

    return { pageResource, pageMap, notFoundSlugs };
  }),

  withComputed((store) => ({
    currentPage: computed(() => {
      const slug = store.currentSlug();
      return slug ? store.pageMap()[slug] ?? null : null;
    }),
    isCurrentNotFound: computed(() => {
      const slug = store.currentSlug();
      return slug != null && store.notFoundSlugs().has(slug);
    }),
    isCurrentLoading: computed(() => {
      const slug = store.currentSlug();
      return slug != null && !store.pageMap()[slug] && store.pageResource.isLoading();
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

### Notes on the design

- **No `withEntities`.** `withEntities` is `patchState`-driven; bridging `httpResource` into it requires `effect()` or `.subscribe()`. `linkedSignal` accumulation gives functionally equivalent ergonomics with a pure-signal pipeline.
- **Trade-off accepted:** `httpResource` uses switchMap-style cancellation under the hood. Rapidly navigating A → B → A re-fetches A on return. Server cache absorbs most of the cost.
- **TransferState seeds the cache** with the SSR-rendered page on client init — back-navigation to the SSR'd page is instant.
- **Pages and 404s cached for the session.** Permanent until reload. No TTL eviction client-side. Server-side TTL handles content freshness.

## Routing

```ts
// app.routes.ts
export const routes: Routes = [
  {
    path: '**',
    loadComponent: () => import('./pages/cms-page/cms-page').then(m => m.CmsPage),
  },
];
```

No per-route `title:` — `CmsPage` sets `<title>` from `seo.title` once the payload arrives.

```ts
// app.routes.server.ts (unchanged from current state)
export const serverRoutes: ServerRoute[] = [
  { path: '**', renderMode: RenderMode.Server },
];
```

### 404 HTTP status

When `PageStore.isCurrentNotFound()` flips true on the server, `CmsPage` sets the response status via the `@angular/ssr` Response API:

```ts
constructor() {
  if (isPlatformServer(inject(PLATFORM_ID))) {
    const response = inject(RESPONSE_INIT, { optional: true });
    effect(() => {
      if (this.store.isCurrentNotFound() && response) {
        response.status = 404;
        response.statusText = 'Not Found';
      }
    });
  }
}
```

This effect is a valid use of `effect()` per the project rule — it syncs signal state to an imperative, non-signal API (the SSR response object).

## CmsPage component

```ts
@Component({
  selector: 'app-cms-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageWaiter, CmsHero, CmsBlockHost, NotFoundPage, MenuOverrideDirective],
  host: {
    '[attr.data-theme]': 'themeAttr()',
    '[class]': 'layoutClass()',
  },
  template: `
    @if (store.isCurrentNotFound()) {
      <app-not-found />
    } @else if (currentPage(); as page) {
      <div [menuOverride]="menuOverride()" menuOverrideKey="cms-page-theme">
        <app-cms-hero [hero]="page.hero" />
        @for (block of page.components; track block.id) {
          <app-cms-block-host [block]="block" />
        }
      </div>
    } @else {
      <app-page-waiter />
    }
  `,
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
      case 'landing-gradient': return 'dark';
      case 'landing-light':
      case 'article-light':    return 'light';
      default:                  return undefined;
    }
  });

  constructor() {
    // signalMethod accepts a Signal directly — no effect wrapper
    this.store.setCurrentSlug(this.slug);

    // Valid effect: syncing signal state → imperative Title/Meta/DOM APIs
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

## Dynamic component rendering — `CmsBlockHost`

`CmsBlockHost` is the **single registry seam** for all CMS component types. CmsPage simply loops; the host owns the `@switch` over all 30 kinds.

```ts
@Component({
  selector: 'app-cms-block-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CmsFaq, CmsFaqSkeleton,
    CmsTable, CmsTableSkeleton,
    CmsImageText, CmsImageTextSkeleton,
    CmsCtaCard, CmsCardSkeleton,
    CmsContentList, CmsContentListSkeleton,
    CmsVideo, CmsVideoSkeleton,
    // ... up to ~30
  ],
  template: `
    @switch (block().kind) {
      @case ('faq') {
        @defer (on viewport; prefetch on idle) {
          <cms-faq [block]="block()" />
        } @placeholder {
          <cms-faq-skeleton />
        }
      }
      @case ('table') {
        @defer (on viewport; prefetch on idle) {
          <cms-table [block]="block()" />
        } @placeholder {
          <cms-table-skeleton />
        }
      }
      @case ('image-text') {
        @defer (on viewport; prefetch on idle) {
          <cms-image-text [block]="block()" />
        } @placeholder {
          <cms-image-text-skeleton />
        }
      }
      // ... up to ~30 cases
    }
  `,
})
export class CmsBlockHost {
  readonly block = input.required<ComponentBlock>();
}
```

### Why this scales to 30 component types

1. **Each `@defer` generates its own JS chunk.** Pages with 5 component types only load 5 chunks. Tree-shaking + lazy hydration = typical pages are light.
2. **`prefetch on idle`** warms chunks during browser idle time, before the block enters the viewport. Smooths scroll.
3. **`withIncrementalHydration()`** means SSR fully renders all blocks. Bots see complete content. Browser hydrates each `@defer` when its trigger fires.
4. **Per-type skeletons** are pure CSS, no logic, no deps — they ship colocated with `CmsBlockHost`. Several component types can share one skeleton when their layouts match (FAQ + content-list, multiple card variants, etc.). Expected ~10–15 unique skeletons across 30 types.

### Shared `CmsBlockHeader`

Every component shares `label / title / description / cta`. A `<cms-block-header [block]="block()" />` subcomponent renders the common header (with consistent heading hierarchy and accessible structure) so each component focuses only on its specific content.

### Adding the 31st component type

1. Create `cms-foo.ts` (standalone) and `cms-foo.skeleton.ts` (or reuse an existing skeleton).
2. Add the new variant to `ComponentBlock` union in `cms.types.ts`.
3. Add a `@case ('foo')` branch in `CmsBlockHost`.

Three files. No module wiring (standalone throughout).

## Theming

CSS variables per `pageType`. No `style` bindings, no `ngClass`.

```scss
// pages/cms-page/cms-page.scss
:host[data-theme="landing-light"] {
  --bg: #ffffff;
  --fg: #111827;
  --accent: #2563eb;
  --surface: #f9fafb;
}
:host[data-theme="landing-dark"] {
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
:host[data-theme="neutral"] {     /* Phase-1 waiter */
  --bg: var(--shell-bg);
  --fg: var(--shell-fg);
}
:host {
  background: var(--bg);
  color: var(--fg);
  min-height: 60vh;
  display: block;
}
```

All CMS components reference `var(--bg)`, `var(--fg)`, `var(--accent)`, `var(--surface)` — they inherit through the cascade and adapt to any page theme automatically.

### Color contrast guarantees

Every `pageType` theme defines `--bg` / `--fg` pairs **tested to ≥ 4.5:1 contrast ratio** (WCAG AA). Gradient themes place text on a semi-opaque overlay (`var(--surface)` with `backdrop-filter: blur` or a solid scrim) so contrast is guaranteed regardless of gradient position.

### Menu / footer theme adaptation

`CmsPage` pushes its theme up to the menu via the existing `menuOverride` directive when the page payload arrives. When the page unmounts (or the waiter is showing), the override unregisters and the menu reverts to its CMS default. Footer follows the global CSS-variable cascade for v1 — a per-page override directive can be added later if needed.

## SEO / meta / JSON-LD

`SeoSyncService` owns the meta-tag and JSON-LD lifecycle. One effect in `CmsPage` calls it when `currentPage()` resolves.

```ts
@Injectable({ providedIn: 'root' })
export class SeoSyncService {
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private jsonLdEl: HTMLScriptElement | null = null;

  applyMeta(seo: SeoData): void {
    this.upsertName('description', seo.description);
    this.upsertName('robots', seo.robots ?? 'index, follow');
    this.upsertLink('canonical', seo.canonical ?? this.doc.location?.href);

    this.upsertProperty('og:title',       seo.ogTitle       ?? seo.title);
    this.upsertProperty('og:description', seo.ogDescription ?? seo.description);
    if (seo.ogImage) this.upsertProperty('og:image', seo.ogImage);

    this.upsertName('twitter:card', seo.twitterCard ?? 'summary_large_image');
  }

  applyJsonLd(jsonLd: object | object[] | undefined): void {
    if (this.jsonLdEl) { this.jsonLdEl.remove(); this.jsonLdEl = null; }
    if (!jsonLd) return;
    const el = this.doc.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(jsonLd);
    this.doc.head.appendChild(el);
    this.jsonLdEl = el;
  }

  private upsertName(name: string, content: string | undefined): void {
    if (!content) { this.meta.removeTag(`name="${name}"`); return; }
    this.meta.updateTag({ name, content });
  }

  private upsertProperty(property: string, content: string | undefined): void {
    if (!content) { this.meta.removeTag(`property="${property}"`); return; }
    this.meta.updateTag({ property, content });
  }

  private upsertLink(rel: string, href: string | undefined): void {
    if (!href) return;
    const existing = this.doc.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (existing) existing.href = href;
    else {
      const link = this.doc.createElement('link');
      link.rel = rel; link.href = href;
      this.doc.head.appendChild(link);
    }
  }
}
```

### Sitemap + robots.txt

Two Express endpoints in the SSR server (`server.ts`), not Angular routes:

- `GET /sitemap.xml` — fetches a slug list from the CMS (`/api/sitemap`), caches 5 min server-side, serves `application/xml` with `<url>` entries for every published slug + `<lastmod>` + `<priority>`.
- `GET /robots.txt` — static file referencing the sitemap; allows all bots by default; can include `Disallow:` directives for staging environments via env var.

Both essential for SEO and LLM crawling.

## Loading UX components

### RouteProgress (global top bar)

```ts
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
    if (e instanceof NavigationEnd
     || e instanceof NavigationCancel
     || e instanceof NavigationError) return false;
    return false;
  });
}
```

Mounted once in the app shell, above everything else. CSS animates the bar's width via a keyframe; `.is-active` triggers the animation. Respects `prefers-reduced-motion`.

### PageWaiter (Phase 1 full-area loader)

```ts
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

- Neutral brand surface — `var(--shell-bg)` / `var(--shell-fg)` (defined on `body`).
- `role="status"` + `aria-live="polite"` so SR announces "Loading page" without interrupting.
- Animation respects `prefers-reduced-motion`.

### Per-type skeletons

Each `@defer` block has a `@placeholder` referencing a tiny CSS-only component. Skeletons are aria-hidden (the `@defer` real content is what SR users care about). Shared skeletons used across component types where layouts match.

## Accessibility (WCAG 2.2 AA)

- **Landmarks:** `<header role="banner">` (menu), `<main id="main-content" tabindex="-1">` (CmsPage host), `<footer role="contentinfo">`.
- **Skip link** at top of `<body>`: `<a href="#main-content" class="skip-link">Skip to main content</a>`, visible on focus.
- **Focus management** on route change: a `RouteFocus` directive on `<main>` calls `.focus()` on `NavigationEnd`. Combined with `withRouterConfig({ scrollPositionRestoration: 'enabled' })`, sighted back-nav returns to scroll position; forward-nav resets focus to top.
- **Heading hierarchy:** hero = `<h1>` (one per page), each `block.title` = `<h2>`, nested = `<h3>`. Linted.
- **Color contrast:** all themes documented as AA-compliant; gradient themes use surface overlays for guaranteed contrast.
- **Native interactives:** `<button>` for actions, `<a>` for navigation. No `<div onclick>`.
- **Images:** CMS `ImageRef.alt` always provided; decorative images use `decorative: true` → rendered with `alt=""`.
- **Video:** captions track required (`VideoRef.captionsSrc`), controls shown, autoplay only when `prefers-reduced-motion: no-preference`.
- **CTA cards:** single `<a>` wrapping the card (no nested interactives).
- **Reduced motion:** RouteProgress pulses instead of sliding, skeletons drop shimmer, hero video doesn't autoplay.
- **AXE in tests:** `@axe-core/playwright` runs against every page-type + hero-variant combination. Zero violations gate.

## FooterStore

Mirror of `MenuStore` — `providedIn: 'root'`, `httpResource('/api/footer')`, TransferState-seeded. `AppFooter` standalone component reads `columns()` / `legal()` from the store. Footer theme follows the global CSS-variable cascade.

## Caching

### Server-side cache (HTTP interceptor)

```ts
// app/interceptors/cms-cache.interceptor.ts
export const cmsCacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID))) return next(req);
  if (req.method !== 'GET' || !req.url.startsWith('/api/')) return next(req);

  const cache = inject(CmsServerCache);
  const ttlMs = ttlFor(req.url);   // 60s for /api/page/*, 300s for /api/menu, /api/footer
  const hit = cache.get(req.url);
  if (hit && hit.expires > Date.now()) {
    return of(new HttpResponse({ status: 200, body: hit.value }));
  }
  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse && event.status === 200) {
        cache.set(req.url, { value: event.body, expires: Date.now() + ttlMs });
      }
    }),
  );
};
```

Wired in `app.config.server.ts`:

```ts
provideHttpClient(withFetch(), withInterceptors([cmsCacheInterceptor]))
```

Server-only. The browser uses its own HTTP cache.

### Edge cache headers

In the Node SSR bootstrap (`server.ts`), after Angular renders:

```ts
if (res.statusCode === 200) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
} else if (res.statusCode === 404) {
  res.setHeader('Cache-Control', 'public, s-maxage=10');
}
res.setHeader('Vary', 'Accept-Encoding');
```

### Cache invalidation (v1)

TTL only. Webhook-driven invalidation is a v2 enhancement; the interceptor seam supports it trivially (one `POST /__cache/bust` endpoint that calls `cache.delete(slug)`).

## Configuration changes

`app.config.ts`:

```ts
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
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
  ],
};
```

`app.config.server.ts`:

```ts
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(withFetch(), withInterceptors([cmsCacheInterceptor])),
  ],
};
```

## Testing

**Unit tests:**

- `PageStore` — slug change triggers fetch, cache accumulates, 404 routes to `notFoundSlugs`, TransferState seed/serialize.
- `SeoSyncService` — `applyMeta` upserts correctly, `applyJsonLd` replaces previous tag, no leaks.
- `RouteProgress` signal logic — events map to `isActive()` correctly.
- Per-component CMS components — input rendering, accessibility roles, optional fields handled.

**Component / integration tests:**

- `CmsPage` with mocked PageStore — renders waiter / page / 404 in correct states.
- `CmsBlockHost` — every `kind` renders its matching component (mocked `@defer` triggers).
- Theme tests — render `CmsPage` with each `pageType`, assert `data-theme` attribute.

**E2E (Playwright):**

- Bot crawl simulation: fetch raw HTML for sample slugs, assert `<title>`, `<meta name="description">`, `<script type="application/ld+json">`, and key visible text present (no JS execution).
- Navigation UX: click a routerLink, assert PageWaiter shows briefly, then content renders. Click back, assert cache hit (no network call).
- 404: visit unknown slug, assert HTTP 404 + NotFound page.
- Lighthouse: Performance ≥ 90, Accessibility = 100, SEO = 100 on representative pages.

**Accessibility tests:**

- `@axe-core/playwright` against rendered pages in every theme variant. Zero violations gate.

## Observability

- Server: log every `/api/page/:slug` cache hit/miss + duration. Counter for 404 rate per slug (spike = CMS data drift).
- Client: web-vitals (LCP, CLS, INP) reported via the analytics layer (wiring out of scope here).
- Error boundary on `CmsBlockHost`: catch render errors in dynamic components so a single bad block doesn't blank the page.

## File-system layout (target)

```
src/app/
  app.config.ts
  app.config.server.ts
  app.routes.ts                       // single catch-all
  app.routes.server.ts
  app.ts                              // shell: <app-route-progress>, <app-main-menu>, <main>, <app-footer>
  app.html
  interceptors/
    cms-cache.interceptor.ts
    cms-server-cache.service.ts
  shell/
    route-progress/route-progress.{ts,scss}
    route-focus.directive.ts
    skip-link/skip-link.{ts,scss}
  menu/
    ...                               // existing structure preserved
  footer/
    footer.{ts,html,scss}
    state/
      footer.store.ts
      footer.types.ts
  pages/
    cms-page/
      cms-page.{ts,html,scss}
      page-waiter/page-waiter.{ts,scss}
      not-found/not-found.{ts,scss}
    state/
      page.store.ts
      page.types.ts
      cms.types.ts                    // CmsPage, ComponentBlock, HeroBlock, SeoData, etc.
  cms/
    block-host/
      cms-block-host.{ts,scss}
      block-header/cms-block-header.{ts,scss}
    hero/
      cms-hero-text.{ts,scss}
      cms-hero-image.{ts,scss}
      cms-hero-video.{ts,scss}
    components/
      faq/cms-faq.{ts,scss}
      faq/cms-faq.skeleton.{ts,scss}
      table/cms-table.{ts,scss}
      table/cms-table.skeleton.{ts,scss}
      image-text/...
      cta-card/...
      content-list/...
      video/...
      // ... up to ~30 component types, each with optional skeleton
    seo/
      seo-sync.service.ts
server.ts                             // existing — extended with sitemap/robots endpoints + cache headers
```

## Migration from current state

The existing `pages/home`, `pages/article`, `pages/search`, `pages/checkout` components and routes are removed in favor of the catch-all CMS-driven model. Their content (if any production value exists) is migrated into the CMS as CMS pages with matching slugs. The existing `MenuStore` and override mechanism are preserved as-is; only `FooterStore` and `PageStore` are added.

## Open questions for implementation

- **CMS endpoint shapes** — the `/api/sitemap` shape (list of `{ slug, lastmod, priority }`) needs CMS team confirmation.
- **Initial component-type set** — design assumes 6 starter types (faq, table, image-text, cta-card, content-list, video). The actual v1 component set will be decided when the CMS schema is finalized.
- **Shell color tokens** — `var(--shell-bg)` / `var(--shell-fg)` defaults need a brand design pass.
- **Reduced-motion variants** — visual designs for the reduced-motion states of RouteProgress, PageWaiter, and skeleton shimmer need approval from the design team before implementation.
- **`@angular/ssr` response token** — code samples reference `RESPONSE_INIT` for setting the SSR HTTP status; the exact symbol name in `@angular/ssr` v21 must be verified at implementation time (the surface has been refined across recent Angular releases).
