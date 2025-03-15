import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-callback',
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class CallbackComponent implements OnInit {
  error: string | null = null;
  processing = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];
      
      if (error) {
        this.error = `Authentication failed: ${error}`;
        this.processing = false;
        return;
      }
      
      if (!code) {
        this.error = 'No authorization code received from Bungie';
        this.processing = false;
        return;
      }
      
      // Exchange code for token
      this.getAccessToken(code, state);
    });
  }

  private getAccessToken(code: string, state: string): void {
    const redirectUrl = environment.bungie.redirectConfig?.useCurrentHost ?
      this.getRedirectUrl() : environment.bungie.redirectUrl;
      
    const tokenRequest = {
      grant_type: 'authorization_code',
      code: code,
      client_id: environment.bungie.clientId,
      client_secret: environment.bungie.clientSecret,
      redirect_uri: redirectUrl // Add this line
    };
  
    // Rest of the method remains the same...
  }
  
  // Add the getRedirectUrl method here as well if needed
  private getRedirectUrl(): string {
    if (!isPlatformBrowser(this.platformId)) return environment.bungie.redirectUrl;
    
    const config = environment.bungie.redirectConfig;
    if (!config) return environment.bungie.redirectUrl;
    
    const protocol = window.location.protocol.replace(':', '');
    const host = window.location.host;
    return `${protocol}://${host}${config.path || '/auth/callback'}`;
  }
}
