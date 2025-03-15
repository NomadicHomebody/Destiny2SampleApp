import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { VaultService } from '../../services/vault.service';
import { DestinyItem, ItemLocation, VaultFilter } from '../../models/vault.models';

@Component({
  selector: 'app-vault',
  templateUrl: './vault.component.html',
  styleUrls: ['./vault.component.css']
})
export class VaultComponent implements OnInit, OnDestroy {
  vaultItems: DestinyItem[] = [];
  filteredItems: DestinyItem[] = [];
  selectedItem: DestinyItem | null = null;
  isLoading = true;
  error: string | null = null;
  
  private subscription = new Subscription();

  constructor(
    private vaultService: VaultService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.isAuthenticated()) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loadItems();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private isAuthenticated(): boolean {
    return localStorage.getItem('authToken') !== null;
  }

  private loadItems(): void {
    this.isLoading = true;
    this.error = null;

    this.subscription.add(
      this.vaultService.vaultItems$.subscribe({
        next: (items) => {
          this.vaultItems = items;
          this.filteredItems = items;
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load vault items. Please try again.';
          this.isLoading = false;
          console.error('Error loading vault items:', err);
        }
      })
    );

    this.vaultService.refreshVaultItems();
  }

  refreshVault(): void {
    this.loadItems();
  }

  selectItem(item: DestinyItem): void {
    this.selectedItem = item;
  }

  closeItemDetail(): void {
    this.selectedItem = null;
  }

  applyFilter(filter: VaultFilter): void {
    if (!filter || Object.keys(filter).length === 0) {
      this.filteredItems = this.vaultItems;
      return;
    }

    this.filteredItems = this.vaultItems.filter(item => {
      let match = true;

      if (filter.itemType !== undefined && filter.itemType !== null) {
        match = match && item.itemType === filter.itemType;
      }

      if (filter.tierType !== undefined && filter.tierType !== null) {
        match = match && item.tierType === filter.tierType;
      }

      if (filter.damageType !== undefined && filter.damageType !== null) {
        match = match && item.damageType === filter.damageType;
      }

      if (filter.minimumPower !== undefined && filter.minimumPower !== null) {
        match = match && item.powerLevel >= filter.minimumPower;
      }

      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        match = match && (
          item.displayProperties.name.toLowerCase().includes(searchLower) ||
          item.displayProperties.description.toLowerCase().includes(searchLower) ||
          item.itemTypeDisplayName.toLowerCase().includes(searchLower)
        );
      }

      return match;
    });
  }

  getItemsForLocation(location: ItemLocation): DestinyItem[] {
    return this.filteredItems.filter(item => item.location === location);
  }

  get vaultItemCount(): number {
    return this.getItemsForLocation(ItemLocation.Vault).length;
  }

  get characterItemCount(): number {
    return this.getItemsForLocation(ItemLocation.Character).length;
  }
}
