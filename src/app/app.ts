import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MainMenu } from './menu/main-menu/main-menu';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, MainMenu],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
