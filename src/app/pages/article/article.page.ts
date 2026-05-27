import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MenuOverrideDirective } from '../../menu/menu-override.directive';
import { ContextualButton, MenuOverride } from '../../menu/state/menu.types';

interface Article {
  id: string;
  title: string;
  body: string;
  bookmarkable: boolean;
}

const ARTICLES: Record<string, Article> = {
  featured: {
    id: 'featured',
    title: 'Featured article',
    body: 'This article triggers the menu to switch to dark theme and exposes a Share button in the right side, since sharing only makes sense while reading an article.',
    bookmarkable: false,
  },
  latest: {
    id: 'latest',
    title: 'Latest article',
    body: 'In addition to Share, this article also reveals a Bookmark button because its CMS metadata says it is bookmarkable. Both buttons disappear when you leave the page.',
    bookmarkable: true,
  },
};

@Component({
  selector: 'app-article-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MenuOverrideDirective, RouterLink],
  template: `
    @let article = currentArticle();
    @if (article) {
      <article class="page" [menuOverride]="override()">
        <h1>{{ article.title }}</h1>
        <p>{{ article.body }}</p>
        <p><a routerLink="/">← Back to Home</a></p>
      </article>
    } @else {
      <section class="page">
        <h1>Article not found</h1>
        <p><a routerLink="/">← Back to Home</a></p>
      </section>
    }
  `,
  styles: `
    .page { max-width: 720px; margin: 2rem auto; padding: 1rem; background: #fafafa; border-radius: 0.5rem; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
  `,
})
export class ArticlePage {
  private readonly route = inject(ActivatedRoute);

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });

  protected readonly currentArticle = computed<Article | null>(() => {
    const id = this.params().get('id');
    return id && ARTICLES[id] ? ARTICLES[id] : null;
  });

  protected readonly override = computed<MenuOverride>(() => {
    const article = this.currentArticle();
    const buttons: ContextualButton[] = [
      {
        id: 'article.share',
        label: 'Share',
        kind: 'action',
        eventId: 'article.share',
        icon: 'share',
        tooltip: 'Share this article',
      },
    ];
    if (article?.bookmarkable) {
      buttons.push({
        id: 'article.bookmark',
        label: 'Bookmark',
        kind: 'action',
        eventId: 'article.bookmark',
        icon: 'bookmark',
        tooltip: 'Bookmark this article',
      });
    }
    return {
      theme: 'dark',
      addButtons: buttons,
    };
  });
}
