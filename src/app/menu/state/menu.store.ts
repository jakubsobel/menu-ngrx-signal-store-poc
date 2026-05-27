import { computed } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { signalStore, withComputed, withProps, withState } from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';
import { menuPageEvents } from './menu-events';
import { MenuCmsData, MenuState, RegisteredOverride, RightButton } from './menu.types';

const initialState: MenuState = {
  overrides: {},
  nextOverrideSeq: 0,
  userCountryCode: null,
  userThemeId: null,
};

function sortedOverrides(
  overrides: Readonly<Record<string, RegisteredOverride>>,
): readonly RegisteredOverride[] {
  return Object.values(overrides).sort((a, b) => a.seq - b.seq);
}

export const MenuStore = signalStore(
  { providedIn: 'root' },
  withState<MenuState>(initialState),
  withProps(() => ({
    menuResource: httpResource<MenuCmsData>(() => '/api/menu'),
  })),
  withReducer(
    on(menuPageEvents.countryChanged, ({ payload }) => ({
      userCountryCode: payload,
    })),
    on(menuPageEvents.themeManuallyChanged, ({ payload }) => ({
      userThemeId: payload,
    })),
    on(menuPageEvents.registerOverride, ({ payload }, state) => ({
      overrides: {
        ...state.overrides,
        [payload.id]: {
          id: payload.id,
          seq: state.nextOverrideSeq,
          override: payload.override,
        },
      },
      nextOverrideSeq: state.nextOverrideSeq + 1,
    })),
    on(menuPageEvents.updateOverride, ({ payload }, state) => {
      const existing = state.overrides[payload.id];
      if (!existing) {
        return {};
      }
      return {
        overrides: {
          ...state.overrides,
          [payload.id]: { ...existing, override: payload.override },
        },
      };
    }),
    on(menuPageEvents.unregisterOverride, ({ payload }, state) => {
      if (!(payload.id in state.overrides)) {
        return {};
      }
      const next = { ...state.overrides };
      delete next[payload.id];
      return { overrides: next };
    }),
  ),
  withComputed((store) => {
    const cmsData = computed(() => store.menuResource.value() ?? null);
    const isLoading = computed(() => store.menuResource.isLoading());
    const hasError = computed(() => store.menuResource.error() != null);
    const loadError = computed(() => {
      const err = store.menuResource.error();
      if (err == null) {
        return null;
      }
      return err instanceof Error ? err.message : String(err);
    });

    const orderedOverrides = computed(() => sortedOverrides(store.overrides()));

    const hiddenIds = computed(() => {
      const set = new Set<string>();
      for (const o of orderedOverrides()) {
        for (const id of o.override.hideButtons ?? []) {
          set.add(id);
        }
      }
      return set;
    });

    const extraButtons = computed(() => {
      const out: RightButton[] = [];
      for (const o of orderedOverrides()) {
        for (const b of o.override.addButtons ?? []) {
          out.push(b);
        }
      }
      return out;
    });

    const effectiveTheme = computed(() => {
      let theme = cmsData()?.defaults.themeId ?? 'light';
      const userTheme = store.userThemeId();
      if (userTheme) {
        theme = userTheme;
      }
      for (const o of orderedOverrides()) {
        if (o.override.theme) {
          theme = o.override.theme;
        }
      }
      return theme;
    });

    const isDimmed = computed(() => orderedOverrides().some((o) => o.override.dim));

    const isCountryPickerVisible = computed(() => {
      if (hiddenIds().has('country-picker')) {
        return false;
      }
      return !orderedOverrides().some((o) => o.override.hideCountryPicker);
    });

    const rightButtons = computed<readonly RightButton[]>(() => {
      const data = cmsData();
      if (!data) {
        return [];
      }
      const base = data.right.filter((b) => !hiddenIds().has(b.id));
      return [...base, ...extraButtons()];
    });

    const effectiveCountryCode = computed(
      () => store.userCountryCode() ?? cmsData()?.defaults.countryCode ?? null,
    );

    return {
      cmsData,
      isLoading,
      hasError,
      loadError,
      orderedOverrides,
      effectiveTheme,
      isDimmed,
      isCountryPickerVisible,
      rightButtons,
      effectiveCountryCode,
      logo: computed(() => cmsData()?.logo ?? null),
      centerItems: computed(() => cmsData()?.center ?? []),
      countries: computed(() => cmsData()?.countries ?? []),
      themes: computed(() => cmsData()?.themes ?? []),
    };
  }),
);
