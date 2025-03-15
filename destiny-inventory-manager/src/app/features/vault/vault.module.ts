import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Import components
import { VaultComponent } from './components/vault/vault.component';
import { ItemDetailComponent } from './components/item-detail/item-detail.component';
import { ItemGridComponent } from './components/item-grid/item-grid.component';
import { ItemFilterComponent } from './components/item-filter/item-filter.component';

// Vault routes
const routes: Routes = [
  { path: '', component: VaultComponent },
  { path: 'item/:id', component: ItemDetailComponent }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class VaultModule { }
