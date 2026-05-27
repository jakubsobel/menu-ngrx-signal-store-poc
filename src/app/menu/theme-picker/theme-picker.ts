import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { injectDispatch } from '@ngrx/signals/events';
import { menuPageEvents } from '../state/menu-events';
import { MenuStore } from '../state/menu.store';

@Component({
  selector: 'app-theme-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="tp-label">
      <span class="tp-label-text">Theme</span>
      <select
        class="tp-select"
        [value]="store.effectiveTheme()"
        (change)="onChange($event)"
        aria-label="Select theme"
      >
        @for (t of store.themes(); track t.id) {
          <option [value]="t.id">{{ t.label }}</option>
        }
      </select>
    </label>
  `,
  styles: `
    :host { display: inline-flex; }
    .tp-label { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; color: var(--menu-fg); }
    .tp-select {
      background: var(--menu-panel-bg);
      color: var(--menu-fg);
      border: 1px solid var(--menu-border);
      border-radius: 0.375rem;
      padding: 0.375rem 0.5rem;
      font: inherit;
    }
    .tp-select:focus-visible { outline: 2px solid var(--menu-accent); outline-offset: 2px; }
  `,
})
export class ThemePicker {
  protected readonly store = inject(MenuStore);
  private readonly dispatch = injectDispatch(menuPageEvents);

  onChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.dispatch.themeManuallyChanged(value);
  }
}
