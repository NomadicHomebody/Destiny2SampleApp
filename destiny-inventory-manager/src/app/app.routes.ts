import { Routes } from '@angular/router';
import { AuthGuard } from './features/auth/guards/auth.guard';
import { ItemDetailComponent } from './features/vault/components/item-detail/item-detail.component';

export const routes: Routes = [
  // Protected routes with AuthGuard
  {
    path: 'vault',
    loadChildren: () => import('./features/vault/vault.routes').then(m => m.VAULT_ROUTES),
    canActivate: [AuthGuard]
  },
  
  // Public routes
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  
  // Default route - check if authenticated, if yes go to vault, otherwise login
  { 
    path: '', 
    redirectTo: (() => {
      // This will be evaluated at runtime
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
      return token ? '/vault' : '/auth/login';
    })(), 
    pathMatch: 'full' 
  },
];