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
