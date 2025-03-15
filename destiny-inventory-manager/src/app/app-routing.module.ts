import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './features/auth/guards/auth.guard';
import { ItemDetailComponent } from './features/vault/components/item-detail/item-detail.component';

const routes: Routes = [
  // Public routes
  { path: 'auth', loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule) },
  
  // Protected routes with AuthGuard
  { 
    path: 'vault', 
    loadChildren: () => import('./features/vault/vault.module').then(m => m.VaultModule),
    canActivate: [AuthGuard]
  },
  { 
    path: 'vault/item/:id', 
    component: ItemDetailComponent,
    canActivate: [AuthGuard]
  },
  
  // Default route
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
