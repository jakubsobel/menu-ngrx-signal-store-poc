import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-route-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    '[attr.aria-hidden]': 'isActive() ? null : "true"',
    '[attr.aria-busy]': 'isActive() ? "true" : null',
    '[class.is-active]': 'isActive()',
  },
  template: `<div class="bar"></div>`,
  styleUrl: './route-progress.scss',
})
export class RouteProgress {
  private readonly router = inject(Router);
  private readonly events = toSignal(this.router.events, { initialValue: null });

  protected readonly isActive = computed(() => {
    const e = this.events();
    if (e instanceof NavigationStart) return true;
    if (
      e instanceof NavigationEnd ||
      e instanceof NavigationCancel ||
      e instanceof NavigationError
    ) {
      return false;
    }
    return false;
  });
}
