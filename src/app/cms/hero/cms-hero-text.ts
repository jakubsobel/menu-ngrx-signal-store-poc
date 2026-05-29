// cms-hero-text.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HeroBlock } from '../../pages/state/cms.types';

type TextHero = Extract<HeroBlock, { kind: 'text' }>;

@Component({
  selector: 'cms-hero-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let h = hero();
    <section class="hero">
      <h1>{{ h.title }}</h1>
      @if (h.description) { <p class="lead">{{ h.description }}</p> }
      @if (h.cta; as cta) {
        <a class="cta" [href]="cta.href" [attr.data-variant]="cta.variant ?? 'primary'">{{ cta.label }}</a>
      }
    </section>
  `,
  styleUrl: './cms-hero-text.scss',
})
export class CmsHeroText {
  readonly hero = input.required<TextHero>();
}
