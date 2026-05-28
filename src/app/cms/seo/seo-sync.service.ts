// src/app/cms/seo/seo-sync.service.ts
import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { SeoData } from '../../pages/state/cms.types';

@Injectable({ providedIn: 'root' })
export class SeoSyncService {
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private jsonLdEl: HTMLScriptElement | null = null;

  applyMeta(seo: SeoData): void {
    this.upsertName('description', seo.description);
    this.upsertName('robots', seo.robots ?? 'index, follow');
    this.upsertLink('canonical', seo.canonical);

    this.upsertProperty('og:title', seo.ogTitle ?? seo.title);
    this.upsertProperty('og:description', seo.ogDescription ?? seo.description);
    if (seo.ogImage) this.upsertProperty('og:image', seo.ogImage);

    this.upsertName('twitter:card', seo.twitterCard ?? 'summary_large_image');
  }

  applyJsonLd(jsonLd: object | object[] | undefined): void {
    if (this.jsonLdEl) {
      this.jsonLdEl.remove();
      this.jsonLdEl = null;
    }
    if (!jsonLd) return;
    const el = this.doc.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(jsonLd);
    this.doc.head.appendChild(el);
    this.jsonLdEl = el;
  }

  private upsertName(name: string, content: string | undefined): void {
    if (!content) {
      this.meta.removeTag(`name="${name}"`);
      return;
    }
    this.meta.updateTag({ name, content });
  }

  private upsertProperty(property: string, content: string | undefined): void {
    if (!content) {
      this.meta.removeTag(`property="${property}"`);
      return;
    }
    this.meta.updateTag({ property, content });
  }

  private upsertLink(rel: string, href: string | undefined): void {
    let existing = this.doc.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!href) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.href = href;
    } else {
      existing = this.doc.createElement('link');
      existing.rel = rel;
      existing.href = href;
      this.doc.head.appendChild(existing);
    }
  }
}
