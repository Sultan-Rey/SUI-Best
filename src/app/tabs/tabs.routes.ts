import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('../tab-home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'ranking',
        loadComponent: () =>
          import('../tab-ranking/ranking.page').then((m) => m.RankingPage),
      },
      {
        path: 'upload',
        loadComponent: () =>
          import('../tab-upload/upload.page').then((m) => m.UploadPage),
      },
      {
        path: 'profile/:id',
        loadComponent: () =>
          import('../tab-profile/profile.page').then((m) => m.ProfilePage),
      },
      {
  path: 'profile',
  loadComponent: () =>
    import('../tab-profile/profile.page').then(m => m.ProfilePage),
  data: { isCurrentUser: true }
},
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full',
  },
];
