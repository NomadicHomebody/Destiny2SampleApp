export interface DestinyItem {
  itemInstanceId: string;
  itemHash: number;
  quantity: number;
  displayProperties: {
    name: string;
    description: string;
    icon: string;
  };
  itemTypeDisplayName: string;
  itemType: number;
  tierType: number;
  tierTypeName: string;
  powerLevel: number;
  damageType: number;
  damageTypeName?: string;
  isEquipped: boolean;
  canEquip: boolean;
  bucketHash: number;
  statValues?: {
    [statHash: string]: number;
  };
  perks?: ItemPerk[];
  location: ItemLocation;
}

export interface ItemPerk {
  perkHash: number;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

export enum ItemLocation {
  Vault = 0,
  Character = 1
}

export interface VaultFilter {
  itemType?: number;
  tierType?: number;
  searchText?: string;
  damageType?: number;
  minimumPower?: number;
}
