import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuOverrideDirective } from '../../menu/menu-override.directive';
import { MenuOverride } from '../../menu/state/menu.types';

@Component({
  selector: 'app-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MenuOverrideDirective],
  template: `
    <section class="page" [menuOverride]="override">
      <h1>Checkout</h1>
      <p>
        On checkout we hide the country picker (the shipping country was already chosen earlier) and
        dim the menu so the focus stays on the form. The dim theme is also pushed by this page.
      </p>
      <form class="form" (submit)="$event.preventDefault()">
        <label>
          Name
          <input name="name" type="text" required autocomplete="name" />
        </label>
        <label>
          Card number
          <input name="card" type="text" inputmode="numeric" autocomplete="cc-number" required />
        </label>
        <button type="submit">Pay now</button>
      </form>
    </section>
  `,
  styles: `
    .page { max-width: 480px; margin: 2rem auto; padding: 1rem; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    .form { display: grid; gap: 1rem; }
    .form label { display: grid; gap: 0.25rem; font-size: 0.875rem; }
    .form input { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font: inherit; }
    .form button { padding: 0.75rem; border: 0; border-radius: 0.375rem; background: #2563eb; color: white; font-weight: 600; cursor: pointer; }
    .form button:focus-visible { outline: 2px solid #1d4ed8; outline-offset: 2px; }
  `,
})
export class CheckoutPage {
  protected readonly override: MenuOverride = {
    hideButtons: ['country-picker'],
    hideCountryPicker: true,
    theme: 'dim',
    dim: true,
  };
}
