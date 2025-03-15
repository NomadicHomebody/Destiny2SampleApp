import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, tap } from 'rxjs';
import { DestinyItem, ItemLocation, ItemPerk } from '../models/vault.models';
import { environment } from '../../../../environments/environment';

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

  constructor(private http: HttpClient) {
    this.loadMembershipInfo();
    if (this.isAuthenticated()) {
      this.refreshVaultItems();
    }
  }

  private loadMembershipInfo(): void {
    this.currentMembershipType = Number(localStorage.getItem('membershipType'));
    this.currentMembershipId = localStorage.getItem('membershipId');
    this.currentCharacterId = localStorage.getItem('characterId');
  }

  private isAuthenticated(): boolean {
    return localStorage.getItem('authToken') !== null && 
           this.currentMembershipId !== null;
  }

  public refreshVaultItems(): void {
    if (!this.isAuthenticated()) {
      console.error('User not authenticated');
      return;
    }

    this.getVaultItems().pipe(
      tap(vaultItems => {
        this.getCharacterItems().subscribe(characterItems => {
          const allItems = [...vaultItems, ...characterItems];
          this.vaultItemsSubject.next(allItems);
        });
      })
    ).subscribe();
  }

  private getVaultItems(): Observable<DestinyItem[]> {
    const endpoint = `${this.apiBase}/Destiny2/${this.currentMembershipType}/Profile/${this.currentMembershipId}/Item/?components=ItemInstances,ItemStats,ItemPerks`;
    
    return this.http.get<any>(endpoint, this.getHeaders()).pipe(
      map(response => {
        const profileInventory = response.Response?.profileInventory?.data?.items || [];
        const itemComponents = response.Response?.itemComponents || {};
        
        return profileInventory
          .filter((item: any) => item.bucketHash === 138197802)
          .map((item: any) => this.processItemData(item, itemComponents, ItemLocation.Vault));
      }),
      catchError(error => {
        console.error('Error fetching vault items', error);
        return [];
      })
    );
  }

  private getCharacterItems(): Observable<DestinyItem[]> {
    const endpoint = `${this.apiBase}/Destiny2/${this.currentMembershipType}/Profile/${this.currentMembershipId}/Character/${this.currentCharacterId}/?components=CharacterInventories,CharacterEquipment,ItemInstances,ItemStats,ItemPerks`;
    
    return this.http.get<any>(endpoint, this.getHeaders()).pipe(
      map(response => {
        const equipment = response.Response?.equipment?.data?.items || [];
        const inventory = response.Response?.inventory?.data?.items || [];
        const itemComponents = response.Response?.itemComponents || {};
        
        return [...equipment, ...inventory]
          .map((item: any) => this.processItemData(item, itemComponents, ItemLocation.Character));
      }),
      catchError(error => {
        console.error('Error fetching character items', error);
        return [];
      })
    );
  }

  private processItemData(item: any, itemComponents: any, location: ItemLocation): DestinyItem {
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
  }

  private processStats(statsData: any): { [statHash: string]: number } {
    const result: { [statHash: string]: number } = {};
    for (const statHash in statsData) {
      if (statsData.hasOwnProperty(statHash)) {
        result[statHash] = statsData[statHash].value;
      }
    }
    return result;
  }

  private processPerks(perksData: any[]): ItemPerk[] {
    if (!perksData || !Array.isArray(perksData)) {
      return [];
    }
    
    return perksData.map(perk => ({
      perkHash: perk.perkHash || 0,
      name: this.getPerkName(perk.perkHash), // Should ideally fetch from manifest
      description: this.getPerkDescription(perk.perkHash), // Should ideally fetch from manifest
      icon: this.getPerkIcon(perk.perkHash), // Should ideally fetch from manifest
      isActive: Boolean(perk.isActive)
    }));
  }

  // Helper methods to get perk details from manifest (placeholder implementation)
  private getPerkName(perkHash: number): string {
    // In a real implementation, you would look up the perk name in the Destiny 2 manifest
    // using the perkHash
    return `Perk ${perkHash}`;
  }

  private getPerkDescription(perkHash: number): string {
    // In a real implementation, you would look up the perk description in the manifest
    return `Description for perk ${perkHash}`;
  }

  private getPerkIcon(perkHash: number): string {
    // In a real implementation, you would get the correct icon path from the manifest
    // and possibly prepend the Bungie.net base URL
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
    return {
      headers: {
        'X-API-Key': this.apiKey,
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    };
  }

  public transferItem(item: DestinyItem, characterId: string): Observable<boolean> {
    console.log(`Transferring item ${item.itemInstanceId} to character ${characterId}`);
    return new Observable<boolean>(observer => {
      setTimeout(() => {
        observer.next(true);
        observer.complete();
      }, 500);
    });
  }

  public equipItem(item: DestinyItem): Observable<boolean> {
    console.log(`Equipping item ${item.itemInstanceId}`);
    return new Observable<boolean>(observer => {
      setTimeout(() => {
        observer.next(true);
        observer.complete();
      }, 500);
    });
  }
}
