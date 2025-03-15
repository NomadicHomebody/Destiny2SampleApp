import { Routes } from '@angular/router';
import { VaultComponent } from './components/vault/vault.component';
import { ItemDetailComponent } from './components/item-detail/item-detail.component';

export const VAULT_ROUTES: Routes = [
  { path: '', component: VaultComponent },
  { path: 'item/:id', component: ItemDetailComponent }
];
