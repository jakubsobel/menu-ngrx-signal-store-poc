import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RightButton } from '../state/menu.types';

@Component({
  selector: 'app-right-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <ul class="right-buttons">
      @for (button of buttons(); track button.id) {
        <li>
          @if (button.kind === 'link' && button.href) {
            <a
              class="rb-item"
              [routerLink]="button.href"
              [attr.aria-label]="button.tooltip || button.label"
              [title]="button.tooltip || button.label"
            >
              <span class="rb-icon" aria-hidden="true">{{ iconFor(button.icon) }}</span>
              <span class="rb-label">{{ button.label }}</span>
            </a>
          } @else {
            <button
              type="button"
              class="rb-item"
              [attr.aria-label]="button.tooltip || button.label"
              [title]="button.tooltip || button.label"
              (click)="actionClicked.emit(button)"
            >
              <span class="rb-icon" aria-hidden="true">{{ iconFor(button.icon) }}</span>
              <span class="rb-label">{{ button.label }}</span>
            </button>
          }
        </li>
      }
    </ul>
  `,
  styleUrl: './right-buttons.scss',
})
export class RightButtons {
  readonly buttons = input.required<readonly RightButton[]>();
  readonly actionClicked = output<RightButton>();

  protected iconFor(icon: string | undefined): string {
    switch (icon) {
      case 'search':
        return '🔍';
      case 'heart':
        return '♡';
      case 'user':
        return '👤';
      case 'cart':
        return '🛒';
      case 'share':
        return '↗';
      case 'bookmark':
        return '🔖';
      default:
        return '•';
    }
  }
}
