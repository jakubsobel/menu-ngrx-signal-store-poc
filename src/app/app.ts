import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MainMenu } from './menu/main-menu/main-menu';
import { AppFooter } from './footer/footer';
import { RouteProgress } from './shell/route-progress/route-progress';
import { SkipLink } from './shell/skip-link/skip-link';
import { RouteFocusDirective } from './shell/route-focus.directive';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    MainMenu,
    AppFooter,
    RouteProgress,
    SkipLink,
    RouteFocusDirective,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
