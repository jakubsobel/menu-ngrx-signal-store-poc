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
    el.textContent = safeJsonLd(jsonLd);
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

/**
 * Serialize a JSON-LD payload safely for embedding in <script> during SSR.
 *
 * `JSON.stringify` does not escape `<`, `>`, `&`, or the U+2028/U+2029 line
 * separators — all of which can break out of a <script> element during HTML
 * serialization. We escape them as `\uXXXX` so the runtime JSON.parse still
 * sees the same logical string, but the HTML serializer can't be tricked.
 */
function safeJsonLd(value: object | object[]): string {
  // U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR cannot be embedded
  // as literals inside a JS regex (they count as line terminators), so we
  // build those two patterns via the RegExp constructor.
  const ls = new RegExp('\u2028', 'g');
  const ps = new RegExp('\u2029', 'g');
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(ls, '\\u2028')
    .replace(ps, '\\u2029');
}
