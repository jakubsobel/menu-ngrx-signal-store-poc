// src/app/pages/state/page.store.ts
import { computed, effect, signal, untracked } from '@angular/core';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
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

// SSR → client handoff for the just-rendered page is handled by
// `withHttpTransferCache` (default in `provideClientHydration`): the server
// `/api/page/:slug` response is replayed in the browser without re-fetching,
// httpResource emits the value, and the cache accumulators pick it up.
//
// Why effect() here:
// `pageMap` and `notFoundSlugs` must skip the network on cache-hit, which
// means the httpResource URL factory has to read them. If both sides are
// reactive (linkedSignal sourced from pageResource ↔ URL factory reading
// pageMap), Angular's signal engine detects a cycle through extRequest and
// throws "Detected cycle in computations." The escape is to make the cache
// imperative — plain `signal()` writes that are bridged from the async
// resource via narrow effects. This is the canonical "async result → state"
// pattern; we're not propagating between user signals, we're absorbing the
// result of an external async API into local store state.
export const PageStore = signalStore(
  { providedIn: 'root' },

  withState<PageState>({ currentSlug: null }),

  withProps((store) => {
    // Plain WritableSignals for the cache. Reading them inside httpResource's
    // URL factory is safe because plain signals have no source/computation
    // machinery that could form a reactive cycle through extRequest.
    const pageMap = signal<Record<string, CmsPage>>({});
    const notFoundSlugs = signal<ReadonlySet<string>>(new Set<string>());

    const pageResource = httpResource<CmsPage>(() => {
      const slug = store.currentSlug();
      if (!slug) return undefined;
      // Skip fetch when the slug is already cached or known to be 404.
      // pageMap/notFoundSlugs are read inside `untracked` so the URL factory
      // depends on currentSlug ONLY. Otherwise the success effect's
      // `pageMap.update` would retrigger this factory, which retriggers
      // httpResource.loadEffect, which re-registers a PendingTask on every
      // tick — Angular SSR never reaches stable state.
      if (untracked(() => pageMap()[slug] || notFoundSlugs().has(slug))) {
        return undefined;
      }
      return `/api/page/${encodeURIComponent(slug)}`;
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

  withHooks({
    onInit(store) {
      // Bridge async httpResource success responses into the page cache.
      effect(() => {
        if (store.pageResource.hasValue()) {
          const page = store.pageResource.value();
          store.pageMap.update((m) => {
            if (m[page.slug] === page) return m;
            return { ...m, [page.slug]: page };
          });
        }
      });

      // Bridge 404 errors into the not-found set.
      effect(() => {
        const err = store.pageResource.error();
        const slug = store.currentSlug();
        if (slug && err instanceof HttpErrorResponse && err.status === 404) {
          store.notFoundSlugs.update((set) => {
            if (set.has(slug)) return set;
            const next = new Set(set);
            next.add(slug);
            return next;
          });
        }
      });
    },
  }),
);
