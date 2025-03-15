export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  membership_id: string;
}

export interface BungieUser {
  membershipId: string;
  displayName: string;
  profilePicturePath?: string;
  uniqueName: string;
  membershipType: number; // Platform type (e.g., Xbox, PSN)
}
