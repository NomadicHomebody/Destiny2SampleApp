import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ProfileComponent implements OnInit {
  userProfile: any = null;
  characters: any[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.fetchUserProfile();
  }

  fetchUserProfile(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading = false;
      return;
    }
    
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'X-API-Key': environment.bungie.apiKey
    });

    // Get current Bungie.net user
    this.http.get(`${environment.bungie.apiRoot}/User/GetMembershipsForCurrentUser/`, { headers })
      .subscribe({
        next: (response: any) => {
          this.userProfile = response.Response;
          
          // If there are Destiny memberships, fetch characters for the first one
          if (this.userProfile?.destinyMemberships?.length > 0) {
            const primaryMembership = this.userProfile.destinyMemberships[0];
            this.fetchCharacters(primaryMembership.membershipType, primaryMembership.membershipId, headers);
          } else {
            this.loading = false;
          }
        },
        error: (err) => {
          this.error = 'Failed to load user profile';
          this.loading = false;
          console.error(err);
        }
      });
  }

  fetchCharacters(membershipType: number, membershipId: string, headers: HttpHeaders): void {
    this.http.get(
      `${environment.bungie.apiRoot}/Destiny2/${membershipType}/Profile/${membershipId}/?components=200`, 
      { headers }
    ).subscribe({
      next: (response: any) => {
        const characters = response.Response?.characters?.data;
        if (characters) {
          this.characters = Object.values(characters);
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load character data';
        this.loading = false;
        console.error(err);
      }
    });
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiry');
    }
    this.router.navigate(['/auth/login']);
  }

  getMembershipTypeName(type: number): string {
    const types: {[key: number]: string} = {
      0: 'None',
      1: 'Xbox',
      2: 'PlayStation',
      3: 'Steam',
      4: 'Blizzard',
      5: 'Stadia',
      6: 'Epic Games',
      10: 'Demon',
      254: 'BungieNext'
    };
    return types[type] || 'Unknown';
  }

  getClassName(type: number): string {
    const classes: {[key: number]: string} = {
      0: 'Titan',
      1: 'Hunter',
      2: 'Warlock'
    };
    return classes[type] || 'Unknown';
  }

  getRaceName(type: number): string {
    const races: {[key: number]: string} = {
      0: 'Human',
      1: 'Awoken',
      2: 'Exo'
    };
    return races[type] || 'Unknown';
  }

  getGenderName(type: number): string {
    const genders: {[key: number]: string} = {
      0: 'Male',
      1: 'Female'
    };
    return genders[type] || 'Unknown';
  }
}
