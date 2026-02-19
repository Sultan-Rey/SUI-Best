import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
  path: 'home',
  loadComponent: () => import('./tab-home/home.page').then(m => m.HomePage)
},
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'subscription',
    loadComponent: () => import('./subscription/subscription.page').then(m => m.SubscriptionPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.page').then( m => m.RegisterPage)
  },
  {
    path: 'content-detail/:id',
    loadComponent: () => import('./content-detail/content-detail.page').then( m => m.ContentDetailPage)
  },
  {
    path: 'content-comments/:id',
    loadComponent: () => import('./content-comments/content-comments.page').then( m => m.ContentCommentsPage)
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.page').then( m => m.SettingsPage)
  },
  {
    path: 'search',
    loadComponent: () => import('./search/search.page').then( m => m.SearchPage)
  },
  {
    path: 'blacklist',
    loadComponent: () => import('./blacklist/blacklist.page').then( m => m.BlacklistPage)
  },
  {
    path: 'profile/:id',
    loadComponent: () => import( './tab-profile/profile.page').then(m => m.ProfilePage)
  },
   {
    path: 'notification',
    loadComponent: () => import('./notification/notification.page').then( m => m.NotificationPage)
  },
  {
    path: '**',
    redirectTo: 'login'
  },
 
  
  
  
 
  
  
];