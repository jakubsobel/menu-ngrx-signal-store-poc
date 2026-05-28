// cms-faq.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentBase, FaqFields } from '../../../pages/state/cms.types';
import { CmsBlockHeader } from '../../block-host/block-header/cms-block-header';

type FaqBlock = ComponentBase & FaqFields & { readonly kind: 'faq' };

@Component({
  selector: 'cms-faq',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CmsBlockHeader],
  template: `
    @let b = block();
    <section class="faq">
      <app-cms-block-header [block]="b" />
      <dl class="items">
        @for (item of b.items; track item.id) {
          <div class="item">
            <dt>{{ item.question }}</dt>
            <dd>{{ item.answer }}</dd>
          </div>
        }
      </dl>
      @if (b.cta; as cta) {
        <a class="cta" [href]="cta.href" [attr.data-variant]="cta.variant ?? 'primary'">{{ cta.label }}</a>
      }
    </section>
  `,
  styleUrl: './cms-faq.scss',
})
export class CmsFaq {
  readonly block = input.required<FaqBlock>();
}
