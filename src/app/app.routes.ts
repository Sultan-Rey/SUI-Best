import { Routes } from '@angular/router';
import { authGuard } from '../guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
  path: 'home',
  loadComponent: () => import('./tab-home/home.page').then(m => m.HomePage),
  canActivate: [authGuard]
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
    loadComponent: () => import('./settings/settings.page').then( m => m.SettingsPage),
    canActivate: [authGuard]
  },
  {
    path: 'search',
    loadComponent: () => import('./search/search.page').then( m => m.SearchPage),
    canActivate: [authGuard]
  },
  {
    path: 'subscription',
    loadComponent: () => import('./subscription/subscription.page').then( m => m.SubscriptionPage)
  },
   {
    path: 'ranking',
    loadComponent: () => import('./tab-ranking/ranking.page').then( m => m.RankingPage),
    canActivate: [authGuard]
  },
  {
    path: 'exclusive',
    loadComponent: () => import('./tab-exclusive/exclusive.page').then( m => m.ExclusivePage),
    canActivate: [authGuard]
  },
  {
    path: 'blacklist',
    loadComponent: () => import('./blacklist/blacklist.page').then( m => m.BlacklistPage),
    canActivate: [authGuard]
  },
  {
    path: 'profile/:id',
    loadComponent: () => import( './tab-profile/profile.page').then(m => m.ProfilePage)
  },
  {
    path: 'password-reset/:id',
    loadComponent: () => import('./password-reset/password-reset.page').then( m => m.PasswordResetPage)
  },
  {
    path: 'default/:arg',
    loadComponent: () => import('./default/default.page').then( m => m.DefaultPage)
  },
  {
    path: '**',
    redirectTo: 'home'
  }


  
  
 
  
  
  
 
  
  
];