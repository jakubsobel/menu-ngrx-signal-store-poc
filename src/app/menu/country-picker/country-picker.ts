import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { injectDispatch } from '@ngrx/signals/events';
import { menuPageEvents } from '../state/menu-events';
import { MenuStore } from '../state/menu.store';

@Component({
  selector: 'app-country-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="cp-label">
      <span class="cp-label-text">Country</span>
      <select
        class="cp-select"
        [value]="store.effectiveCountryCode() ?? ''"
        (change)="onChange($event)"
        aria-label="Select country"
      >
        @for (c of store.countries(); track c.code) {
          <option [value]="c.code">{{ c.label }}</option>
        }
      </select>
    </label>
  `,
  styles: `
    :host { display: inline-flex; }
    .cp-label { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; color: var(--menu-fg); }
    .cp-select {
      background: var(--menu-panel-bg);
      color: var(--menu-fg);
      border: 1px solid var(--menu-border);
      border-radius: 0.375rem;
      padding: 0.375rem 0.5rem;
      font: inherit;
    }
    .cp-select:focus-visible { outline: 2px solid var(--menu-accent); outline-offset: 2px; }
  `,
})
export class CountryPicker {
  protected readonly store = inject(MenuStore);
  private readonly dispatch = injectDispatch(menuPageEvents);

  onChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.dispatch.countryChanged(value);
  }
}
