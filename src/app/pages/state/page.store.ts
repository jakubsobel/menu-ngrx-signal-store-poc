// src/app/pages/state/page.store.ts
import { computed, effect, linkedSignal, signal } from '@angular/core';
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
// httpResource emits the value, and `pageMap`/`notFoundSlugs` accumulate it.
//
// Design note on effect() usage:
// Two plain WritableSignals (`pageMap`, `notFoundSlugs`) serve as the cache
// stores and are read by the httpResource URL factory (plain signals don't
// create reactive cycles with httpResource's internal linkedSignal chain).
// Effects in onInit imperatively sync httpResource results into these signals.
// This is a legitimate use of effect() for bridging an async resource API to
// local state — NOT a signal→signal state propagation pattern.
export const PageStore = signalStore(
  { providedIn: 'root' },

  withState<PageState>({ currentSlug: null }),

  withProps((store) => {
    // Plain WritableSignals for the cache. Reading them inside httpResource's
    // URL factory is safe: plain signals have no source/computation machinery
    // that could create reactive cycles through httpResource's extRequest
    // linkedSignal chain.
    const pageMap = signal<Record<string, CmsPage>>({});
    const notFoundSlugs = signal<ReadonlySet<string>>(new Set<string>());

    const pageResource = httpResource<CmsPage>(() => {
      const slug = store.currentSlug();
      if (!slug) return undefined;
      // Skip fetch when the slug is already cached or marked not-found.
      if (pageMap()[slug] || notFoundSlugs().has(slug)) return undefined;
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
      // Sync httpResource success responses into the page cache.
      effect(() => {
        if (store.pageResource.hasValue()) {
          const page = store.pageResource.value();
          store.pageMap.update((m) => {
            if (m[page.slug] === page) return m;
            return { ...m, [page.slug]: page };
          });
        }
      });

      // Sync httpResource 404 errors into the not-found set.
      effect(() => {
        const err = store.pageResource.error();
        const slug = store.currentSlug();
        if (
          slug &&
          err instanceof HttpErrorResponse &&
          err.status === 404
        ) {
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
