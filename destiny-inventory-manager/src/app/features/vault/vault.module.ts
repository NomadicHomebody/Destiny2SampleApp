import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { VaultComponent } from './components/vault/vault.component';
import { ItemFilterComponent } from './components/item-filter/item-filter.component';
import { ItemDetailComponent } from './components/item-detail/item-detail.component';
import { VAULT_ROUTES } from './vault.routes';

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    RouterModule.forChild(VAULT_ROUTES),
    // Import standalone components instead of declaring them
    VaultComponent,
    ItemFilterComponent,
    ItemDetailComponent
  ]
})
export class VaultModule { }
