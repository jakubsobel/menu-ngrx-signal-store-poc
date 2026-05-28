import { Directive, ElementRef, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Directive({ selector: '[appRouteFocus]' })
export class RouteFocusDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly events = toSignal(this.router.events, { initialValue: null });

  constructor() {
    // Valid effect: signal state → imperative DOM focus API.
    effect(() => {
      if (this.events() instanceof NavigationEnd) {
        this.el.nativeElement.focus({ preventScroll: false });
      }
    });
  }
}
