import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  REQUEST_CONTEXT,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { SsrRequestContext } from '../../shell/ssr-context';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MenuOverrideDirective } from '../../menu/menu-override.directive';
import { MenuOverride } from '../../menu/state/menu.types';
import { PageStore } from '../state/page.store';
import { CmsHeroText } from '../../cms/hero/cms-hero-text';
import { CmsHeroImage } from '../../cms/hero/cms-hero-image';
import { CmsHeroVideo } from '../../cms/hero/cms-hero-video';
import { CmsBlockHost } from '../../cms/block-host/cms-block-host';
import { SeoSyncService } from '../../cms/seo/seo-sync.service';
import { PageWaiter } from './page-waiter/page-waiter';
import { NotFoundPage } from './not-found/not-found';

@Component({
  selector: 'app-cms-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CmsHeroText,
    CmsHeroImage,
    CmsHeroVideo,
    CmsBlockHost,
    PageWaiter,
    NotFoundPage,
    MenuOverrideDirective,
  ],
  host: {
    '[attr.data-theme]': 'themeAttr()',
    '[class]': 'layoutClass()',
  },
  templateUrl: './cms-page.html',
  styleUrl: './cms-page.scss',
})
export class CmsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly seoSync = inject(SeoSyncService);
  protected readonly store = inject(PageStore);

  private readonly slug = toSignal(
    this.route.url.pipe(map((segs) => '/' + segs.map((s) => s.path).join('/'))),
    { initialValue: '/' },
  );

  protected readonly currentPage = this.store.currentPage;
  protected readonly isNotFound = this.store.isCurrentNotFound;

  protected readonly themeAttr = computed(() => this.currentPage()?.pageType ?? 'neutral');
  protected readonly layoutClass = computed(() =>
    this.currentPage() ? `page-${this.currentPage()!.pageType}` : 'page-waiting',
  );

  // MenuOverride.theme is `string | undefined` so undefined is valid here.
  protected readonly menuOverride = computed<MenuOverride>(() => ({
    theme: this.themeForMenu(),
  }));
  private readonly themeForMenu = computed<string | undefined>(() => {
    switch (this.currentPage()?.pageType) {
      case 'landing-dark':
      case 'landing-gradient':
        return 'dark';
      case 'landing-light':
      case 'article-light':
        return 'light';
      default:
        return undefined;
    }
  });

  constructor() {
    this.store.setCurrentSlug(this.slug);

    // Valid effect: syncing signal state → imperative Title/Meta/DOM APIs.
    effect(() => {
      const page = this.currentPage();
      if (!page) return;
      this.title.setTitle(page.seo.title);
      this.seoSync.applyMeta(page.seo);
      this.seoSync.applyJsonLd(page.seo.jsonLd);
    });

    if (isPlatformServer(inject(PLATFORM_ID))) {
      const ctx = inject(REQUEST_CONTEXT, { optional: true }) as SsrRequestContext | null;
      // Valid effect: syncing signal state → imperative Express Response API.
      effect(() => {
        if (this.isNotFound() && ctx?.response && !ctx.response.headersSent) {
          ctx.response.statusCode = 404;
        }
      });
    }
  }
}
