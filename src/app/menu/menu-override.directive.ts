import {
  Directive,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  input,
} from '@angular/core';
import { injectDispatch } from '@ngrx/signals/events';
import { menuPageEvents } from './state/menu-events';
import { MenuOverride } from './state/menu.types';

@Directive({
  selector: '[menuOverride]',
})
export class MenuOverrideDirective implements OnInit, OnChanges, OnDestroy {
  readonly menuOverride = input.required<MenuOverride>();
  readonly menuOverrideKey = input.required<string>();

  private readonly dispatch = injectDispatch(menuPageEvents);
  private registered = false;

  ngOnInit(): void {
    this.dispatch.registerOverride({
      id: this.menuOverrideKey(),
      override: this.menuOverride(),
    });
    this.registered = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.registered && changes['menuOverride']) {
      this.dispatch.updateOverride({
        id: this.menuOverrideKey(),
        override: this.menuOverride(),
      });
    }
  }

  ngOnDestroy(): void {
    if (this.registered) {
      this.dispatch.unregisterOverride({ id: this.menuOverrideKey() });
    }
  }
}
