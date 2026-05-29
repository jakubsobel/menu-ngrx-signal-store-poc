import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '**',
    loadComponent: () =>
      import('./pages/cms-page/cms-page').then((m) => m.CmsPage),
  },
];
