import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { HeroBlock } from '../../pages/state/cms.types';

type ImageHero = Extract<HeroBlock, { kind: 'image' }>;

@Component({
  selector: 'cms-hero-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  template: `
    @let h = hero();
    <section class="hero">
      <div class="image">
        <img
          [ngSrc]="h.image.src"
          [width]="h.image.width"
          [height]="h.image.height"
          [alt]="h.image.decorative ? '' : h.image.alt"
          priority
          fetchpriority="high"
        />
      </div>
      <div class="copy">
        <h1>{{ h.title }}</h1>
        @if (h.description) { <p class="lead">{{ h.description }}</p> }
        @if (h.cta; as cta) {
          <a class="cta" [href]="cta.href" [attr.data-variant]="cta.variant ?? 'primary'">{{ cta.label }}</a>
        }
      </div>
    </section>
  `,
  styleUrl: './cms-hero-image.scss',
})
export class CmsHeroImage {
  readonly hero = input.required<ImageHero>();
}
