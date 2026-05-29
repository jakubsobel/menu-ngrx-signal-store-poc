// src/app/pages/state/cms.types.ts

export type PageType =
  | 'landing-light'
  | 'landing-dark'
  | 'landing-gradient'
  | 'article-light'
  | 'article-dark';

export interface Cta {
  readonly label: string;
  readonly href: string;
  readonly variant?: 'primary' | 'secondary' | 'link';
}

export interface ImageRef {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly decorative?: boolean;
}

export interface VideoRef {
  readonly src: string;
  readonly type: 'mp4' | 'webm' | 'youtube' | 'vimeo';
  readonly captionsSrc?: string;
}

export interface SeoData {
  readonly title: string;
  readonly description: string;
  readonly canonical?: string;
  readonly robots?: string;
  readonly ogTitle?: string;
  readonly ogDescription?: string;
  readonly ogImage?: string;
  readonly twitterCard?: 'summary' | 'summary_large_image';
  readonly jsonLd?: object | object[];
}

export type HeroBlock =
  | { readonly kind: 'text'; readonly title: string; readonly description?: string; readonly cta?: Cta }
  | { readonly kind: 'image'; readonly title: string; readonly description?: string; readonly image: ImageRef; readonly cta?: Cta }
  | { readonly kind: 'video'; readonly title: string; readonly description?: string; readonly video: VideoRef; readonly poster?: ImageRef; readonly cta?: Cta };

export interface ComponentBase {
  readonly id: string;
  readonly label?: string;
  readonly title?: string;
  readonly description?: string;
  readonly cta?: Cta;
}

export interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface FaqFields {
  readonly items: readonly FaqItem[];
}

export interface ImageTextFields {
  readonly image: ImageRef;
  readonly body: string;
  readonly layout?: 'image-left' | 'image-right';
}

export type ComponentBlock =
  | ({ readonly kind: 'faq' } & ComponentBase & FaqFields)
  | ({ readonly kind: 'image-text' } & ComponentBase & ImageTextFields);
// NOTE: extend this union as new component types are added (see spec "Adding the 31st component type").

export interface CmsPage {
  readonly slug: string;
  readonly pageType: PageType;
  readonly seo: SeoData;
  readonly hero: HeroBlock;
  readonly components: readonly ComponentBlock[];
}
