import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'cms-faq-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="row"></div>
    <div class="row"></div>
    <div class="row"></div>
  `,
  styleUrl: './cms-faq.skeleton.scss',
})
export class CmsFaqSkeleton {}
