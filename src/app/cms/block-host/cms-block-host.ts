// cms-block-host.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentBlock } from '../../pages/state/cms.types';
import { CmsFaq } from '../components/faq/cms-faq';
import { CmsFaqSkeleton } from '../components/faq/cms-faq.skeleton';

@Component({
  selector: 'app-cms-block-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CmsFaq, CmsFaqSkeleton],
  template: `
    @switch (block().kind) {
      @case ('faq') {
        @defer (on viewport; prefetch on idle) {
          <cms-faq [block]="$any(block())" />
        } @placeholder {
          <cms-faq-skeleton />
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
