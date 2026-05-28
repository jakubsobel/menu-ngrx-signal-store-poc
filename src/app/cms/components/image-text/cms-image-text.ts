import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ComponentBase, ImageTextFields } from '../../../pages/state/cms.types';
import { CmsBlockHeader } from '../../block-host/block-header/cms-block-header';

type ImageTextBlock = ComponentBase & ImageTextFields & { readonly kind: 'image-text' };

@Component({
  selector: 'cms-image-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, CmsBlockHeader],
  host: { '[attr.data-layout]': 'block().layout ?? "image-left"' },
  template: `
    @let b = block();
    <section class="image-text">
      <div class="image">
        <img
          [ngSrc]="b.image.src"
          [width]="b.image.width"
          [height]="b.image.height"
          [alt]="b.image.decorative ? '' : b.image.alt"
          loading="lazy"
        />
      </div>
      <div class="copy">
        <app-cms-block-header [block]="b" />
        <div class="body">{{ b.body }}</div>
        @if (b.cta; as cta) {
          <a class="cta" [href]="cta.href" [attr.data-variant]="cta.variant ?? 'primary'">{{ cta.label }}</a>
        }
      </div>
    </section>
  `,
  styleUrl: './cms-image-text.scss',
})
export class CmsImageText {
  readonly block = input.required<ImageTextBlock>();
}
