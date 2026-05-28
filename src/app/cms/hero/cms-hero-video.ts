import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
          [muted]="autoMuted()"
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
  protected readonly autoplay = computed(() => this.prefersMotion());
  protected readonly autoMuted = computed(() => this.prefersMotion());

  private prefersMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
