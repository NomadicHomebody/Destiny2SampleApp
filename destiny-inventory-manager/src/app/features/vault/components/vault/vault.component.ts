import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { VaultService } from '../../services/vault.service';
import { DestinyItem, ItemLocation, VaultFilter } from '../../models/vault.models';
import { CommonModule } from '@angular/common';
import { ItemFilterComponent } from '../item-filter/item-filter.component';
import { LoggingService } from '../../../../core/services/logging.service';

@Component({
  selector: 'app-vault',
  templateUrl: './vault.component.html',
  styleUrls: ['./vault.component.css'],
  standalone: true,
  imports: [CommonModule, ItemFilterComponent]
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
    private router: Router,
    private loggingService: LoggingService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.loggingService.debug('VaultComponent', 'Initializing vault component', {
      isAuthenticated: this.isAuthenticated()
    });
    
    if (!this.isAuthenticated()) {
      this.loggingService.warn('VaultComponent', 'User not authenticated, redirecting to login');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loadItems();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private isAuthenticated(): boolean {
    const isAuth = isPlatformBrowser(this.platformId) && 
           localStorage.getItem('authToken') !== null && 
           this.getMembershipId() !== null;
           
    return isAuth;
  }
  
  private getMembershipId(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('membershipId');
    }
    return null;
  }

  private loadItems(): void {
    this.isLoading = true;
    this.error = null;
    
    this.loggingService.info('VaultComponent', 'Loading vault items');

    this.subscription.add(
      this.vaultService.vaultItems$.subscribe({
        next: (items) => {
          this.vaultItems = items;
          this.filteredItems = items;
          this.isLoading = false;
          this.loggingService.debug('VaultComponent', 'Vault items loaded successfully', {
            itemCount: items.length
          });
        },
        error: (err) => {
          this.error = 'Failed to load vault items. Please try again.';
          this.isLoading = false;
          this.loggingService.error('VaultComponent', 'Error loading vault items', err);
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

  transferToVault(item: DestinyItem): void {
    if (!item || item.location === ItemLocation.Vault) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.subscription.add(
      this.vaultService.transferItem(item, ItemLocation.Character).subscribe({
        next: (success) => {
          if (success) {
            // Update the item's location locally until next refresh
            const updatedItem = this.vaultItems.find(i => i.itemInstanceId === item.itemInstanceId);
            if (updatedItem) {
              updatedItem.location = ItemLocation.Vault;
            }
            this.refreshVault(); // Refresh the vault to get updated data
          } else {
            this.error = 'Failed to transfer item to vault.';
          }
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to transfer item to vault. Please try again.';
          this.isLoading = false;
          this.loggingService.error('VaultComponent', 'Error transferring item to vault', err);
        }
      })
    );
  }

  transferToCharacter(item: DestinyItem): void {
    if (!item || item.location === ItemLocation.Character) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.subscription.add(
      this.vaultService.transferItem(item, ItemLocation.Character).subscribe({
        next: (success) => {
          if (success) {
            // Update the item's location locally until next refresh
            const updatedItem = this.vaultItems.find(i => i.itemInstanceId === item.itemInstanceId);
            if (updatedItem) {
              updatedItem.location = ItemLocation.Character;
              updatedItem.isEquipped = false;
            }
            this.refreshVault(); // Refresh the vault to get updated data
          } else {
            this.error = 'Failed to transfer item to character.';
          }
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to transfer item to character. Please try again.';
          this.isLoading = false;
          this.loggingService.error('VaultComponent', 'Error transferring item to character', err);
        }
      })
    );
  }

  equipItem(item: DestinyItem): void {
    if (!item || item.location !== ItemLocation.Character || item.isEquipped || !item.canEquip) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.subscription.add(
      this.vaultService.equipItem(item).subscribe({
        next: (success) => {
          if (success) {
            // Update item status locally
            const updatedItem = this.vaultItems.find(i => i.itemInstanceId === item.itemInstanceId);
            if (updatedItem) {
              updatedItem.isEquipped = true;
              
              // Unequip other items of the same type
              if (updatedItem.bucketHash) {
                this.vaultItems.forEach(i => {
                  if (i.itemInstanceId !== item.itemInstanceId && 
                      i.bucketHash === updatedItem.bucketHash && 
                      i.isEquipped) {
                    i.isEquipped = false;
                  }
                });
              }
            }
            this.refreshVault(); // Refresh to get complete updated data
          } else {
            this.error = 'Failed to equip item.';
          }
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to equip item. Please try again.';
          this.isLoading = false;
          this.loggingService.error('VaultComponent', 'Error equipping item', err);
        }
      })
    );
  }
}