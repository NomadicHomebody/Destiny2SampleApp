import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ItemDetailComponent } from './features/vault/components/item-detail/item-detail.component';

const authGuard = () => {
  const router = inject(Router);
  const isAuthenticated = localStorage.getItem('authToken') !== null;
  if (!isAuthenticated) {
    router.navigate(['/auth/login']);
    return false;
  }
  return true;
};

const routes: Routes = [
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

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
