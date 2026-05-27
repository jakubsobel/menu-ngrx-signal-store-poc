import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from '../state/menu.types';

@Component({
  selector: 'app-dropdown-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close()',
  },
  template: `
    @let item = menuItem();
    @let isLeaf = !item.children || item.children.length === 0;

    @if (isLeaf) {
      <a
        class="dropdown-link"
        [class.is-root]="depth() === 0"
        [routerLink]="item.href"
        routerLinkActive="is-active"
        [routerLinkActiveOptions]="{ exact: item.href === '/' }"
      >
        {{ item.label }}
      </a>
    } @else {
      <button
        type="button"
        class="dropdown-trigger"
        [class.is-root]="depth() === 0"
        [attr.aria-haspopup]="'menu'"
        [attr.aria-expanded]="isOpen()"
        (click)="toggle($event)"
        (keydown.arrowDown)="openAndFocus($event)"
        (keydown.arrowRight)="depth() > 0 ? openAndFocus($event) : null"
      >
        <span>{{ item.label }}</span>
        <span class="chevron" aria-hidden="true">{{ depth() === 0 ? '▾' : '▸' }}</span>
      </button>

      @if (isOpen()) {
        <ul
          class="dropdown-panel"
          [class.is-nested]="depth() > 0"
          role="menu"
          [attr.aria-label]="item.label"
        >
          @for (child of item.children; track child.id) {
            <li role="none">
              <app-dropdown-item
                role="menuitem"
                [menuItem]="child"
                [depth]="depth() + 1"
              />
            </li>
          }
        </ul>
      }
    }
  `,
  styleUrl: './dropdown-item.scss',
})
export class DropdownItem {
  readonly menuItem = input.required<MenuItem>();
  readonly depth = input<number>(0);

  protected readonly isOpen = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  toggle(event: Event): void {
    event.stopPropagation();
    this.isOpen.update((v) => !v);
  }

  openAndFocus(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.isOpen.set(false);
    }
  }
}
