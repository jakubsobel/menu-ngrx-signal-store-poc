import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CountryPicker } from '../country-picker/country-picker';
import { DropdownItem } from '../dropdown-item/dropdown-item';
import { MenuStore } from '../state/menu.store';
import { RightButton } from '../state/menu.types';
import { RightButtons } from '../right-buttons/right-buttons';
import { ThemePicker } from '../theme-picker/theme-picker';

@Component({
  selector: 'app-main-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DropdownItem, RightButtons, CountryPicker, ThemePicker],
  host: {
    '[attr.data-theme]': 'store.effectiveTheme()',
    '[class.is-dimmed]': 'store.isDimmed()',
    '[attr.aria-busy]': 'store.isLoading() ? "true" : null',
    role: 'banner',
  },
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss',
})
export class MainMenu {
  protected readonly store = inject(MenuStore);

  onAction(button: RightButton): void {
    console.log('[MainMenu] action button clicked:', button.eventId ?? button.id);
  }
}
