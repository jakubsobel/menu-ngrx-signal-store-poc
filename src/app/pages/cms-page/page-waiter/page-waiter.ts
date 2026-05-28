import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-page-waiter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    'aria-label': 'Loading page',
  },
  template: `
    <div class="waiter">
      <div class="brand-mark" aria-hidden="true">◆</div>
      <span class="visually-hidden">Loading page…</span>
    </div>
  `,
  styleUrl: './page-waiter.scss',
})
export class PageWaiter {}
