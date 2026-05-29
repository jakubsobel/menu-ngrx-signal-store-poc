// src/app/cms/seo/seo-sync.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { SeoSyncService } from './seo-sync.service';
import { SeoData } from '../../pages/state/cms.types';

describe('SeoSyncService', () => {
  let svc: SeoSyncService;
  let meta: Meta;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    svc = TestBed.inject(SeoSyncService);
    meta = TestBed.inject(Meta);
    doc = TestBed.inject(DOCUMENT);
    doc.head
      .querySelectorAll('meta, link[rel="canonical"], script[type="application/ld+json"]')
      .forEach((n) => n.remove());
  });

  it('applyMeta sets description, robots default, OG, twitter', () => {
    const seo: SeoData = {
      title: 'T',
      description: 'D',
      ogImage: 'https://example.com/og.png',
    };
    svc.applyMeta(seo);
    expect(meta.getTag('name="description"')?.content).toBe('D');
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
    expect(meta.getTag('property="og:title"')?.content).toBe('T');
    expect(meta.getTag('property="og:image"')?.content).toBe('https://example.com/og.png');
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
  });

  it('applyJsonLd inserts a script tag with the payload', () => {
    svc.applyJsonLd({ '@type': 'Article', name: 'X' });
    const script = doc.head.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent!)).toEqual({ '@type': 'Article', name: 'X' });
  });

  it('applyJsonLd replaces a previous tag', () => {
    svc.applyJsonLd({ '@type': 'A' });
    svc.applyJsonLd({ '@type': 'B' });
    const scripts = doc.head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].textContent!)).toEqual({ '@type': 'B' });
  });

  it('applyJsonLd(undefined) removes the existing tag', () => {
    svc.applyJsonLd({ '@type': 'A' });
    svc.applyJsonLd(undefined);
    expect(doc.head.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('escapes </script> in jsonLd to prevent SSR XSS', () => {
    svc.applyJsonLd({ name: '</script><script>alert(1)</script>' });
    const script = doc.head.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    // No literal </script> survives in the serialized output.
    expect(script!.textContent).not.toContain('</script>');
    // The escaped form is still valid JSON and round-trips.
    expect(JSON.parse(script!.textContent!)).toEqual({
      name: '</script><script>alert(1)</script>',
    });
  });
});
