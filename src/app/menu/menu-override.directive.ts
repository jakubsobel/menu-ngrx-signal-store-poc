import {
  Directive,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
  input,
} from '@angular/core';
import { Dispatcher } from '@ngrx/signals/events';
import { menuPageEvents } from './state/menu-events';
import { MenuOverride } from './state/menu.types';

let nextId = 0;

@Directive({
  selector: '[menuOverride]',
})
export class MenuOverrideDirective implements OnInit, OnChanges, OnDestroy {
  readonly menuOverride = input.required<MenuOverride>();

  private readonly id = `menu-override-${++nextId}`;
  private readonly dispatcher = inject(Dispatcher);
  private registered = false;

  ngOnInit(): void {
    this.dispatcher.dispatch(
      menuPageEvents.registerOverride({ id: this.id, override: this.menuOverride() }),
    );
    this.registered = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.registered && changes['menuOverride']) {
      this.dispatcher.dispatch(
        menuPageEvents.updateOverride({ id: this.id, override: this.menuOverride() }),
      );
    }
  }

  ngOnDestroy(): void {
    if (this.registered) {
      this.dispatcher.dispatch(menuPageEvents.unregisterOverride({ id: this.id }));
    }
  }
}
