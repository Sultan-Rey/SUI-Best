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
    path: 'register',
    loadComponent: () => import('./register/register.page').then( m => m.RegisterPage)
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
    path: 'subscription',
    loadComponent: () => import('./subscription/subscription.page').then( m => m.SubscriptionPage)
  },
   {
    path: 'ranking',
    loadComponent: () => import('./tab-ranking/ranking.page').then( m => m.RankingPage)
  },
  {
    path: 'exclusive',
    loadComponent: () => import('./tab-exclusive/exclusive.page').then( m => m.ExclusivePage)
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
    path: '**',
    redirectTo: 'login'
  }
  
  
 
  
  
  
 
  
  
];