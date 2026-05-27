import { MenuCmsData } from './menu.types';

export const MENU_FIXTURE: MenuCmsData = {
  logo: {
    label: 'Acme Co.',
    href: '/',
  },
  center: [
    {
      id: 'home',
      label: 'Home',
      href: '/',
    },
    {
      id: 'products',
      label: 'Products',
      children: [
        {
          id: 'products.audio',
          label: 'Audio',
          children: [
            { id: 'products.audio.headphones', label: 'Headphones', href: '/products/audio/headphones' },
            { id: 'products.audio.speakers', label: 'Speakers', href: '/products/audio/speakers' },
            { id: 'products.audio.microphones', label: 'Microphones', href: '/products/audio/microphones' },
          ],
        },
        {
          id: 'products.video',
          label: 'Video',
          children: [
            { id: 'products.video.cameras', label: 'Cameras', href: '/products/video/cameras' },
            { id: 'products.video.tripods', label: 'Tripods', href: '/products/video/tripods' },
          ],
        },
        {
          id: 'products.accessories',
          label: 'Accessories',
          href: '/products/accessories',
        },
      ],
    },
    {
      id: 'articles',
      label: 'Articles',
      children: [
        { id: 'articles.featured', label: 'Featured article', href: '/article/featured' },
        { id: 'articles.latest', label: 'Latest article', href: '/article/latest' },
      ],
    },
    {
      id: 'about',
      label: 'About',
      href: '/about',
    },
  ],
  right: [
    {
      id: 'search',
      label: 'Search',
      kind: 'action',
      eventId: 'menu.search',
      icon: 'search',
      tooltip: 'Search the site',
    },
    {
      id: 'wishlist',
      label: 'Wishlist',
      kind: 'link',
      href: '/wishlist',
      icon: 'heart',
      tooltip: 'Your wishlist',
    },
    {
      id: 'account',
      label: 'Account',
      kind: 'link',
      href: '/account',
      icon: 'user',
      tooltip: 'Your account',
    },
    {
      id: 'cart',
      label: 'Cart',
      kind: 'link',
      href: '/checkout',
      icon: 'cart',
      tooltip: 'Go to checkout',
    },
  ],
  countries: [
    { code: 'US', label: 'United States' },
    { code: 'GB', label: 'United Kingdom' },
    { code: 'DE', label: 'Germany' },
    { code: 'PL', label: 'Poland' },
    { code: 'JP', label: 'Japan' },
  ],
  themes: [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'dim', label: 'Dim' },
  ],
  defaults: {
    countryCode: 'US',
    themeId: 'light',
  },
};
