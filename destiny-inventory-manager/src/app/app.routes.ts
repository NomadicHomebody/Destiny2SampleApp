import { Routes } from '@angular/router';
import { AuthGuard } from './features/auth/guards/auth.guard';
import { ItemDetailComponent } from './features/vault/components/item-detail/item-detail.component';

export const routes: Routes = [
  // Public routes
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  
  // Protected routes with AuthGuard
  {
    path: 'vault',
    loadChildren: () => import('./features/vault/vault.routes').then(m => m.VAULT_ROUTES),
    canActivate: [AuthGuard]
  },
  
  // Default route
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
];