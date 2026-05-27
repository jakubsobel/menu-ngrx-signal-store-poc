import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuOverrideDirective } from '../../menu/menu-override.directive';
import { MenuOverride } from '../../menu/state/menu.types';

@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MenuOverrideDirective],
  template: `
    <section class="page" [menuOverride]="override" menuOverrideKey="search-page">
      <h1>Search</h1>
      <p>
        This page hides the <strong>Search</strong> button in the right side of the main menu, since
        the user is already on the search page. Navigate away to restore it.
      </p>
      <input type="search" class="search-input" placeholder="Type to search..." aria-label="Search" />
    </section>
  `,
  styles: `
    .page { max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    .search-input {
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 1rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
    }
  `,
})
export class SearchPage {
  protected readonly override: MenuOverride = {
    hideButtons: ['search'],
  };
}
