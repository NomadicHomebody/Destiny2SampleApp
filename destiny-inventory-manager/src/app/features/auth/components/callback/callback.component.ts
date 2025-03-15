import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-callback',
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.css']
})
export class CallbackComponent implements OnInit {
  error: string | null = null;
  processing = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
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
    const tokenRequest = {
      grant_type: 'authorization_code',
      code: code,
      client_id: environment.bungie.clientId,
      client_secret: environment.bungie.clientSecret
    };

    this.http.post<any>(`${environment.bungie.apiRoot}/App/OAuth/Token/`, tokenRequest)
      .subscribe({
        next: (response) => {
          // Store tokens
          localStorage.setItem('authToken', response.access_token);
          localStorage.setItem('refreshToken', response.refresh_token);
          localStorage.setItem('tokenExpiry', (Date.now() + (response.expires_in * 1000)).toString());
          
          // Redirect to vault or profile
          this.router.navigate(['/vault']);
        },
        error: (err) => {
          this.error = 'Failed to exchange authorization code for access token';
          this.processing = false;
          console.error(err);
        }
      });
  }
}
