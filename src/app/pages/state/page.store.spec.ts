// src/app/pages/state/page.store.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PageStore } from './page.store';

describe('PageStore', () => {
  let httpMock: HttpTestingController;
  let store: InstanceType<typeof PageStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(PageStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts with no current slug and a null currentPage', () => {
    expect(store.currentSlug()).toBeNull();
    expect(store.currentPage()).toBeNull();
    expect(store.isCurrentNotFound()).toBe(false);
  });

  it('setCurrentSlug triggers a fetch and caches the result', async () => {
    store.setCurrentSlug('/foo');
    TestBed.flushEffects();

    const req = httpMock.expectOne('/api/page/%2Ffoo');
    req.flush({
      slug: '/foo',
      pageType: 'landing-light',
      seo: { title: 'Foo', description: 'd' },
      hero: { kind: 'text', title: 'Hello' },
      components: [],
    });

    await Promise.resolve();
    TestBed.flushEffects();
    expect(store.currentPage()?.slug).toBe('/foo');
  });

  it('navigating back to a cached slug does not refetch', async () => {
    store.setCurrentSlug('/foo');
    TestBed.flushEffects();
    httpMock.expectOne('/api/page/%2Ffoo').flush({
      slug: '/foo',
      pageType: 'landing-light',
      seo: { title: 'Foo', description: 'd' },
      hero: { kind: 'text', title: 'Hello' },
      components: [],
    });
    await Promise.resolve();
    TestBed.flushEffects();

    store.setCurrentSlug('/bar');
    TestBed.flushEffects();
    httpMock.expectOne('/api/page/%2Fbar').flush({
      slug: '/bar',
      pageType: 'landing-dark',
      seo: { title: 'Bar', description: 'd' },
      hero: { kind: 'text', title: 'Hi' },
      components: [],
    });
    await Promise.resolve();
    TestBed.flushEffects();

    store.setCurrentSlug('/foo');
    TestBed.flushEffects();
    httpMock.expectNone('/api/page/%2Ffoo');
    expect(store.currentPage()?.slug).toBe('/foo');
  });

  it('records 404s and marks the slug as not found', async () => {
    store.setCurrentSlug('/missing');
    TestBed.flushEffects();

    const req = httpMock.expectOne('/api/page/%2Fmissing');
    req.flush('not found', { status: 404, statusText: 'Not Found' });

    await Promise.resolve();
    TestBed.flushEffects();
    expect(store.isCurrentNotFound()).toBe(true);
    expect(store.currentPage()).toBeNull();
  });
});
