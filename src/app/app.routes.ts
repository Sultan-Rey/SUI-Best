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
    path: 'profile',
    loadComponent: () => import('./tab-profile/profile.page').then( m => m.ProfilePage)
  },
  {
    path: '**',
    redirectTo: 'login'
  },
 
  
  
];