import { Routes } from '@angular/router';
import { ItemDetailComponent } from './features/vault/components/item-detail/item-detail.component';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

const authGuard = () => {
  const router = inject(Router);
  const isAuthenticated = localStorage.getItem('authToken') !== null;
  if (!isAuthenticated) {
    router.navigate(['/auth/login']);
    return false;
  }
  return true;
};

export const routes: Routes = [
  { path: '', redirectTo: '/vault', pathMatch: 'full' },
  { 
    path: 'auth', 
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  { 
    path: 'vault', 
    loadChildren: () => import('./features/vault/vault.module').then(m => m.VaultModule),
    canActivate: [() => authGuard()]
  },
  { path: 'vault/item/:id', component: ItemDetailComponent }
];