import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FooterStore } from './footer.store';

describe('FooterStore', () => {
  let httpMock: HttpTestingController;
  let store: InstanceType<typeof FooterStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(FooterStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('exposes empty columns/legal until the resource resolves', () => {
    // Before the httpResource effect runs, the resource has no value yet.
    expect(store.columns()).toEqual([]);
    expect(store.legal()).toBeNull();
    // Absorb the effect-driven request (may or may not have fired) so
    // afterEach verify() is satisfied.
    TestBed.flushEffects();
    httpMock.expectOne('/api/footer').flush({ columns: [], legal: { copyright: '', links: [] } });
  });

  it('populates columns/legal once /api/footer resolves', async () => {
    // Flush the scheduled effect so the HTTP request is in flight.
    TestBed.flushEffects();
    const req = httpMock.expectOne('/api/footer');
    req.flush({
      columns: [{ id: 'about', title: 'About', links: [] }],
      legal: { copyright: '© 2026', links: [] },
    });

    await Promise.resolve();
    expect(store.columns()).toHaveLength(1);
    expect(store.legal()?.copyright).toBe('© 2026');
  });
});
