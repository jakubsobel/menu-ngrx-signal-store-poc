import { FooterCmsData } from './footer.types';

export const FOOTER_FIXTURE: FooterCmsData = {
  columns: [
    {
      id: 'company',
      title: 'Company',
      links: [
        { id: 'about', label: 'About', href: '/about' },
        { id: 'careers', label: 'Careers', href: '/careers' },
        { id: 'press', label: 'Press', href: '/press' },
      ],
    },
    {
      id: 'support',
      title: 'Support',
      links: [
        { id: 'help', label: 'Help center', href: '/help' },
        { id: 'contact', label: 'Contact', href: '/contact' },
      ],
    },
    {
      id: 'legal',
      title: 'Legal',
      links: [
        { id: 'privacy', label: 'Privacy', href: '/privacy' },
        { id: 'terms', label: 'Terms', href: '/terms' },
      ],
    },
  ],
  legal: {
    copyright: '© 2026 Acme Co.',
    links: [
      { id: 'cookies', label: 'Cookie policy', href: '/cookies' },
    ],
  },
};
