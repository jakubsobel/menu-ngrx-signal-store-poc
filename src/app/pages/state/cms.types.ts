// src/app/pages/state/cms.types.ts

export type PageType =
  | 'landing-light'
  | 'landing-dark'
  | 'landing-gradient'
  | 'article-light'
  | 'article-dark';

export interface Cta {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary' | 'link';
}

export interface ImageRef {
  src: string;
  alt: string;
  width: number;
  height: number;
  decorative?: boolean;
}

export interface VideoRef {
  src: string;
  type: 'mp4' | 'webm' | 'youtube' | 'vimeo';
  captionsSrc?: string;
}

export interface SeoData {
  title: string;
  description: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  jsonLd?: object | object[];
}

export type HeroBlock =
  | { kind: 'text'; title: string; description?: string; cta?: Cta }
  | { kind: 'image'; title: string; description?: string; image: ImageRef; cta?: Cta }
  | { kind: 'video'; title: string; description?: string; video: VideoRef; poster?: ImageRef; cta?: Cta };

export interface ComponentBase {
  id: string;
  label?: string;
  title?: string;
  description?: string;
  cta?: Cta;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqFields {
  items: FaqItem[];
}

export interface ImageTextFields {
  image: ImageRef;
  body: string;
  layout?: 'image-left' | 'image-right';
}

export type ComponentBlock =
  | ({ kind: 'faq' } & ComponentBase & FaqFields)
  | ({ kind: 'image-text' } & ComponentBase & ImageTextFields);
// NOTE: extend this union as new component types are added (see spec "Adding the 31st component type").

export interface CmsPage {
  slug: string;
  pageType: PageType;
  seo: SeoData;
  hero: HeroBlock;
  components: ComponentBlock[];
}
