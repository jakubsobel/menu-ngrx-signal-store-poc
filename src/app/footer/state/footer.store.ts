import { computed } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { FooterCmsData } from './footer.types';

// SSR → client handoff is handled automatically by `withHttpTransferCache`
// (default in `provideClientHydration`) — the server `/api/footer` response is
// replayed in the browser without re-fetching, so no manual `TransferState`
// serialization is needed here.
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
    hasError: computed(() => store.footerResource.error() != null),
    loadError: computed(() => {
      const err = store.footerResource.error();
      if (err == null) return null;
      return err instanceof Error ? err.message : String(err);
    }),
  })),
);
