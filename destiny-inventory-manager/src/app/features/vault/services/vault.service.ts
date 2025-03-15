import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, tap, of } from 'rxjs';
import { DestinyItem, ItemLocation, ItemPerk } from '../models/vault.models';
import { environment } from '../../../../environments/environment';
import { LoggingService, LogLevel } from '../../../core/services/logging.service';
import { ErrorUtils, ErrorCode } from '../../../core/utils/error-utils';

@Injectable({
  providedIn: 'root'
})
export class VaultService {
  private vaultItemsSubject = new BehaviorSubject<DestinyItem[]>([]);
  public vaultItems$ = this.vaultItemsSubject.asObservable();

  private apiKey = environment.bungie.apiKey;
  private apiBase = 'https://www.bungie.net/Platform';
  private currentMembershipType: number | null = null;
  private currentMembershipId: string | null = null;
  private currentCharacterId: string | null = null;
  
  // Flag to track if refresh is in progress
  private isRefreshing = false;

  constructor(
    private http: HttpClient,
    private loggingService: LoggingService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (this.isBrowser()) {
      this.loadMembershipInfo();
      if (this.isAuthenticated()) {
        this.refreshVaultItems();
      }
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private loadMembershipInfo(): void {
    if (this.isBrowser()) {
      try {
        this.currentMembershipType = Number(localStorage.getItem('membershipType'));
        this.currentMembershipId = localStorage.getItem('membershipId');
        this.currentCharacterId = localStorage.getItem('characterId');
        
        // Log successful initialization
        this.loggingService.debug('VaultService', 'Membership info loaded', {
          membershipType: this.currentMembershipType,
          hasMembershipId: !!this.currentMembershipId,
          hasCharacterId: !!this.currentCharacterId
        });
      } catch (error) {
        this.loggingService.error(
          'VaultService', 
          'Failed to load membership information',
          error,
          ErrorCode.AUTH_FAILED
        );
      }
    }
  }

  private isAuthenticated(): boolean {
    const isAuth = this.isBrowser() && 
           localStorage.getItem('authToken') !== null && 
           this.currentMembershipId !== null;
           
    if (!isAuth) {
      this.loggingService.debug('VaultService', 'User not authenticated');
    }
    
    return isAuth;
  }

  public refreshVaultItems(): void {
    if (!this.isAuthenticated()) {
      this.loggingService.warn('VaultService', 'Cannot refresh vault: user not authenticated');
      return;
    }
    
    // Prevent multiple simultaneous refreshes
    if (this.isRefreshing) {
      this.loggingService.debug('VaultService', 'Refresh already in progress, skipping');
      return;
    }
    
    this.isRefreshing = true;
    this.loggingService.info('VaultService', 'Starting vault refresh');

    this.getVaultItems().pipe(
      tap(vaultItems => {
        this.loggingService.debug('VaultService', 'Vault items loaded', { count: vaultItems.length });
        
        this.getCharacterItems().pipe(
          tap(characterItems => {
            this.loggingService.debug('VaultService', 'Character items loaded', { count: characterItems.length });
            
            const allItems = [...vaultItems, ...characterItems];
            this.vaultItemsSubject.next(allItems);
            
            this.loggingService.info('VaultService', 'Vault refresh complete', { 
              totalItems: allItems.length,
              vaultItems: vaultItems.length,
              characterItems: characterItems.length
            });
          }),
          catchError(error => {
            this.loggingService.error(
              'VaultService', 
              'Failed to load character items', 
              error, 
              ErrorCode.INVENTORY_ERROR,
              { membershipId: this.currentMembershipId, characterId: this.currentCharacterId }
            );
            
            // Still use vault items even if character items failed
            this.vaultItemsSubject.next(vaultItems);
            return of([]); // Return empty list but don't break the chain
          }),
          // Always mark refresh as complete
          tap(() => this.isRefreshing = false)
        ).subscribe();
      }),
      catchError(error => {
        this.loggingService.error(
          'VaultService', 
          'Failed to load vault items', 
          error, 
          ErrorCode.VAULT_ERROR,
          { membershipId: this.currentMembershipId }
        );
        
        this.isRefreshing = false;
        return of([]); // Return empty list but don't break the chain
      })
    ).subscribe();
  }

  private getVaultItems(): Observable<DestinyItem[]> {
    const endpoint = `${this.apiBase}/Destiny2/${this.currentMembershipType}/Profile/${this.currentMembershipId}/Item/?components=ItemInstances,ItemStats,ItemPerks`;
    
    this.loggingService.debug('VaultService', 'Fetching vault items', { endpoint });
    const startTime = Date.now();
    
    return this.http.get<any>(endpoint, this.getHeaders()).pipe(
      map(response => {
        const profileInventory = response.Response?.profileInventory?.data?.items || [];
        const itemComponents = response.Response?.itemComponents || {};
        
        const vaultItems = profileInventory
          .filter((item: any) => item.bucketHash === 138197802)
          .map((item: any) => this.processItemData(item, itemComponents, ItemLocation.Vault));
        
        const duration = Date.now() - startTime;
        this.loggingService.debug('VaultService', 'Vault items processed', { 
          count: vaultItems.length, 
          duration: `${duration}ms` 
        });
        
        return vaultItems;
      }),
      catchError((error: HttpErrorResponse) => {
        return ErrorUtils.handleHttpError(
          error,
          this.loggingService,
          'VaultService',
          'Failed to retrieve vault items',
          {
            membershipType: this.currentMembershipType,
            membershipId: this.currentMembershipId
          }
        );
      })
    );
  }

  private getCharacterItems(): Observable<DestinyItem[]> {
    const endpoint = `${this.apiBase}/Destiny2/${this.currentMembershipType}/Profile/${this.currentMembershipId}/Character/${this.currentCharacterId}/?components=CharacterInventories,CharacterEquipment,ItemInstances,ItemStats,ItemPerks`;
    
    this.loggingService.debug('VaultService', 'Fetching character items', { endpoint });
    const startTime = Date.now();
    
    return this.http.get<any>(endpoint, this.getHeaders()).pipe(
      map(response => {
        const equipment = response.Response?.equipment?.data?.items || [];
        const inventory = response.Response?.inventory?.data?.items || [];
        const itemComponents = response.Response?.itemComponents || {};
        
        const characterItems = [...equipment, ...inventory]
          .map((item: any) => this.processItemData(item, itemComponents, ItemLocation.Character));
        
        const duration = Date.now() - startTime;
        this.loggingService.debug('VaultService', 'Character items processed', { 
          count: characterItems.length, 
          duration: `${duration}ms`,
          equipped: equipment.length,
          inventory: inventory.length
        });
        
        return characterItems;
      }),
      catchError((error: HttpErrorResponse) => {
        return ErrorUtils.handleHttpError(
          error,
          this.loggingService,
          'VaultService',
          'Failed to retrieve character items',
          {
            membershipType: this.currentMembershipType,
            membershipId: this.currentMembershipId,
            characterId: this.currentCharacterId
          }
        );
      })
    );
  }

  private processItemData(item: any, itemComponents: any, location: ItemLocation): DestinyItem {
    try {
      const instanceData = itemComponents.instances?.data?.[item.itemInstanceId] || {};
      const statsData = itemComponents.stats?.data?.[item.itemInstanceId]?.stats || {};
      const perksData = itemComponents.perks?.data?.[item.itemInstanceId]?.perks || [];

      return {
        itemInstanceId: item.itemInstanceId,
        itemHash: item.itemHash,
        quantity: item.quantity || 1,
        displayProperties: {
          name: `Item ${item.itemHash}`,
          description: 'Item description',
          icon: `/assets/placeholder.png`,
        },
        itemTypeDisplayName: 'Unknown Type',
        itemType: 0,
        tierType: instanceData.tierType || 0,
        tierTypeName: 'Common',
        powerLevel: instanceData.primaryStat?.value || 0,
        damageType: instanceData.damageType || 0,
        damageTypeName: this.getDamageTypeName(instanceData.damageType),
        isEquipped: item.isEquipped || false,
        canEquip: true,
        bucketHash: item.bucketHash,
        statValues: this.processStats(statsData),
        perks: this.processPerks(perksData),
        location: location
      };
    } catch (error) {
      this.loggingService.error(
        'VaultService',
        'Error processing item data',
        error,
        ErrorCode.INVALID_DATA,
        { itemHash: item?.itemHash, itemInstanceId: item?.itemInstanceId }
      );
      
      // Return a minimal item to avoid breaking the UI
      return {
        itemInstanceId: item?.itemInstanceId || 'unknown',
        itemHash: item?.itemHash || 0,
        quantity: 1,
        displayProperties: {
          name: 'Error: Invalid Item',
          description: 'This item could not be properly loaded',
          icon: `/assets/error_item.png`,
        },
        itemTypeDisplayName: 'Unknown',
        itemType: 0,
        tierType: 0,
        tierTypeName: 'Common',
        powerLevel: 0,
        damageType: 0,
        damageTypeName: 'None',
        isEquipped: false,
        canEquip: false,
        bucketHash: item?.bucketHash || 0,
        location: location
      };
    }
  }

  private processStats(statsData: any): { [statHash: string]: number } {
    const result: { [statHash: string]: number } = {};
    try {
      for (const statHash in statsData) {
        if (statsData.hasOwnProperty(statHash)) {
          result[statHash] = statsData[statHash].value;
        }
      }
    } catch (error) {
      this.loggingService.warn(
        'VaultService',
        'Error processing item stats',
        error,
        ErrorCode.INVALID_DATA
      );
    }
    return result;
  }

  private processPerks(perksData: any[]): ItemPerk[] {
    if (!perksData || !Array.isArray(perksData)) {
      return [];
    }
    
    try {
      return perksData.map(perk => ({
        perkHash: perk.perkHash || 0,
        name: this.getPerkName(perk.perkHash),
        description: this.getPerkDescription(perk.perkHash),
        icon: this.getPerkIcon(perk.perkHash),
        isActive: Boolean(perk.isActive)
      }));
    } catch (error) {
      this.loggingService.warn(
        'VaultService',
        'Error processing item perks',
        error,
        ErrorCode.INVALID_DATA
      );
      return [];
    }
  }

  // Helper methods to get perk details from manifest (placeholder implementation)
  private getPerkName(perkHash: number): string {
    return `Perk ${perkHash}`;
  }

  private getPerkDescription(perkHash: number): string {
    return `Description for perk ${perkHash}`;
  }

  private getPerkIcon(perkHash: number): string {
    return `/assets/icons/perks/${perkHash}.png`;
  }

  private getDamageTypeName(damageType: number): string {
    switch(damageType) {
      case 1: return 'Kinetic';
      case 2: return 'Arc';
      case 3: return 'Solar';
      case 4: return 'Void';
      case 5: return 'Raid';
      case 6: return 'Stasis';
      case 7: return 'Strand';
      default: return 'None';
    }
  }

  private getHeaders() {
    const headers: any = {
      'X-API-Key': this.apiKey
    };
    
    if (this.isBrowser() && localStorage.getItem('authToken')) {
      headers['Authorization'] = `Bearer ${localStorage.getItem('authToken')}`;
    }
    
    return { headers };
  }

  public transferItem(item: DestinyItem, targetLocation: ItemLocation): Observable<boolean> {
    this.loggingService.info('VaultService', 'Transferring item', {
      itemId: item.itemInstanceId,
      itemName: item.displayProperties.name,
      from: item.location === ItemLocation.Vault ? 'Vault' : 'Character',
      to: targetLocation === ItemLocation.Vault ? 'Vault' : 'Character'
    });
    
    // In a real implementation, this would call the Bungie API
    // Here we're simulating the API call
    return new Observable<boolean>(observer => {
      setTimeout(() => {
        // Simulate success with occasional failures for testing
        const success = Math.random() > 0.1; // 90% success rate
        
        if (success) {
          this.loggingService.info('VaultService', 'Item transfer successful', {
            itemId: item.itemInstanceId
          });
          observer.next(true);
        } else {
          const error = new Error('Transfer failed - simulated error');
          this.loggingService.error(
            'VaultService',
            'Failed to transfer item',
            error,
            ErrorCode.INVENTORY_ERROR,
            {
              itemId: item.itemInstanceId,
              itemName: item.displayProperties.name
            }
          );
          observer.next(false);
        }
        observer.complete();
      }, 500);
    });
  }

  public equipItem(item: DestinyItem): Observable<boolean> {
    if (!item || item.location !== ItemLocation.Character || item.isEquipped || !item.canEquip) {
      this.loggingService.warn('VaultService', 'Invalid equip request', {
        itemId: item?.itemInstanceId,
        isInCharacterInventory: item?.location === ItemLocation.Character,
        isAlreadyEquipped: item?.isEquipped,
        canEquip: item?.canEquip
      });
      return of(false);
    }
    
    this.loggingService.info('VaultService', 'Equipping item', {
      itemId: item.itemInstanceId,
      itemName: item.displayProperties.name,
      itemType: item.itemTypeDisplayName
    });
    
    // In a real implementation, this would call the Bungie API
    return new Observable<boolean>(observer => {
      setTimeout(() => {
        // Simulate success with occasional failures for testing
        const success = Math.random() > 0.1; // 90% success rate
        
        if (success) {
          this.loggingService.info('VaultService', 'Item equipped successfully', {
            itemId: item.itemInstanceId
          });
          observer.next(true);
        } else {
          const error = new Error('Equip failed - simulated error');
          this.loggingService.error(
            'VaultService',
            'Failed to equip item',
            error,
            ErrorCode.EQUIPMENT_ERROR,
            {
              itemId: item.itemInstanceId,
              itemName: item.displayProperties.name
            }
          );
          observer.next(false);
        }
        observer.complete();
      }, 500);
    });
  }
}