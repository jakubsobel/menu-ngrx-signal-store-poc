import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="page">
      <h1>Home</h1>
      <p>
        Baseline page — the main menu shows its default CMS-driven state. Use the links below to see
        how route components manipulate the menu via NgRx Signal Store events.
      </p>
      <ul class="links">
        <li><a routerLink="/search">/search — hides the Search button</a></li>
        <li><a routerLink="/article/featured">/article/featured — dark theme + Share button</a></li>
        <li><a routerLink="/article/latest">/article/latest — dark theme + Share + Bookmark</a></li>
        <li><a routerLink="/checkout">/checkout — hides Country picker, dims menu</a></li>
      </ul>
    </section>
  `,
  styles: `
    .page { max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    .links { list-style: disc; padding-left: 1.25rem; line-height: 2; }
  `,
})
export class HomePage {}
