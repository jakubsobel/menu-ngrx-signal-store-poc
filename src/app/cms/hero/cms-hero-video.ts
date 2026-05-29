import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  input,
  signal,
} from '@angular/core';
import { HeroBlock } from '../../pages/state/cms.types';

type VideoHero = Extract<HeroBlock, { kind: 'video' }>;

@Component({
  selector: 'cms-hero-video',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let h = hero();
    <section class="hero">
      <div class="media">
        <video
          [poster]="h.poster?.src ?? null"
          [src]="h.video.src"
          controls
          preload="metadata"
          playsinline
          [muted]="autoplay()"
          [autoplay]="autoplay()"
        ></video>
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
  styleUrl: './cms-hero-video.scss',
})
export class CmsHeroVideo {
  readonly hero = input.required<VideoHero>();
  // SSR-safe default — autoplay only flips on after the client hydrates and
  // we can read prefers-reduced-motion without diverging from the server DOM.
  protected readonly autoplay = signal(false);

  constructor() {
    afterNextRender(() => {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      this.autoplay.set(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    });
  }
}
