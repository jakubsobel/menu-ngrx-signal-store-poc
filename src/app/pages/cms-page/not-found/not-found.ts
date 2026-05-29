import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="not-found">
      <h1>Page not found</h1>
      <p>The page you're looking for isn't available.</p>
      <a routerLink="/" class="home-link">Go to home</a>
    </section>
  `,
  styleUrl: './not-found.scss',
})
export class NotFoundPage {}
