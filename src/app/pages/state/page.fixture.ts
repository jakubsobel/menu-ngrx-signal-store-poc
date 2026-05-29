import { CmsPage, PageType } from './cms.types';

/**
 * Local fixture used by the dev SSR server for any unknown slug.
 * Returns a deterministic CmsPage with a text hero and two component blocks
 * so SSR has something to render until a real CMS backend is wired.
 *
 * Returns null for slugs starting with `/not-found` to exercise the 404 path.
 */
export function pageFixtureFor(slug: string): CmsPage | null {
  if (slug.startsWith('/not-found')) return null;

  const pageType: PageType = slug.includes('dark')
    ? 'landing-dark'
    : slug.includes('gradient')
      ? 'landing-gradient'
      : 'landing-light';

  return {
    slug,
    pageType,
    seo: {
      title: `Sample page ${slug}`,
      description: `A fixture page rendered for ${slug}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `Sample page ${slug}`,
      },
    },
    hero: {
      kind: 'text',
      title: `Welcome to ${slug}`,
      description: 'This page is served from a local dev fixture.',
      cta: { label: 'Learn more', href: '/about', variant: 'primary' },
    },
    components: [
      {
        kind: 'faq',
        id: 'faq-1',
        title: 'Frequently asked questions',
        items: [
          { id: 'q1', question: 'What is this?', answer: 'A demo page.' },
          { id: 'q2', question: 'How does it work?', answer: 'SSR + signals.' },
        ],
      },
      {
        kind: 'image-text',
        id: 'it-1',
        title: 'An image with text',
        body: 'This block demonstrates the image+text component layout.',
        image: {
          src: 'https://placehold.co/600x400/4338ca/ffffff?text=Demo',
          alt: 'Demo image',
          width: 600,
          height: 400,
        },
        layout: 'image-left',
      },
    ],
  };
}
