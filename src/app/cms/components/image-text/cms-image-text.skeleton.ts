import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'cms-image-text-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="row">
      <div class="image-ph"></div>
      <div class="copy-ph">
        <div class="line short"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line short"></div>
      </div>
    </div>
  `,
  styleUrl: './cms-image-text.skeleton.scss',
})
export class CmsImageTextSkeleton {}
