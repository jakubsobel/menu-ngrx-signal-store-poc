import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';
import { MenuOverride } from './menu.types';

export const menuPageEvents = eventGroup({
  source: 'Menu Page',
  events: {
    themeManuallyChanged: type<string>(),
    countryChanged: type<string>(),
    registerOverride: type<{ id: string; override: MenuOverride }>(),
    updateOverride: type<{ id: string; override: MenuOverride }>(),
    unregisterOverride: type<{ id: string }>(),
  },
});
