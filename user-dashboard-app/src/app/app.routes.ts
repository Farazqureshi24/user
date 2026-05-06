import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/user-dashboard.component').then((module) => module.UserDashboardComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
