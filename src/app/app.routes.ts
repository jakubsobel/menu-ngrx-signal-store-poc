import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
    title: 'Home',
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.page').then((m) => m.SearchPage),
    title: 'Search',
  },
  {
    path: 'article/:id',
    loadComponent: () => import('./pages/article/article.page').then((m) => m.ArticlePage),
    title: 'Article',
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout.page').then((m) => m.CheckoutPage),
    title: 'Checkout',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
