// cms-block-host.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentBlock } from '../../pages/state/cms.types';
import { CmsFaq } from '../components/faq/cms-faq';
import { CmsFaqSkeleton } from '../components/faq/cms-faq.skeleton';
import { CmsImageText } from '../components/image-text/cms-image-text';
import { CmsImageTextSkeleton } from '../components/image-text/cms-image-text.skeleton';

@Component({
  selector: 'app-cms-block-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CmsFaq, CmsFaqSkeleton, CmsImageText, CmsImageTextSkeleton],
  template: `
    @switch (block().kind) {
      @case ('faq') {
        @defer (on viewport; prefetch on idle) {
          <cms-faq [block]="$any(block())" />
        } @placeholder {
          <cms-faq-skeleton />
        }
      }
      @case ('image-text') {
        @defer (on viewport; prefetch on idle) {
          <cms-image-text [block]="$any(block())" />
        } @placeholder {
          <cms-image-text-skeleton />
        }
      }
      @default {}
    }
  `,
  styleUrl: './cms-block-host.scss',
})
export class CmsBlockHost {
  readonly block = input.required<ComponentBlock>();
}
