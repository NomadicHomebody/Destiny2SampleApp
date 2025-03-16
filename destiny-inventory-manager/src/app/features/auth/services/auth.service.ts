import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthToken, BungieUser } from '../models/auth.models';
import { LoggingService } from '../../../core/services/logging.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<BungieUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenExpirationTimer: any;
  private isAuthenticating = false; // Flag to prevent concurrent auth attempts

  constructor(
    private http: HttpClient,
    private router: Router,
    private loggingService: LoggingService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (this.isBrowser()) {
      this.checkStoredToken();
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  public login(): void {
    this.loggingService.info('AuthService', 'Login method called');
    
    if (!this.isBrowser()) {
      this.loggingService.warn('AuthService', 'Cannot redirect: not in browser environment');
      return;
    }
    
    if (this.isAuthenticating) {
      this.loggingService.warn('AuthService', 'Authentication already in progress');
      return;
    }
    
    this.isAuthenticating = true;
    
    try {
      const redirectUrl = this.getRedirectUrl();
      this.loggingService.debug('AuthService', 'Generated redirect URL', { 
        redirectUrl,
        authUrl: environment.bungie.authUrl,
        clientId: environment.bungie.clientId
      });
      
      // Generate a unique state parameter to prevent CSRF
      const state = this.generateRandomState();
      if (this.isBrowser()) {
        sessionStorage.setItem('auth_state', state);
      }
      
      const authUrl = `${environment.bungie.authUrl}?client_id=${environment.bungie.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${state}`;
      
      this.loggingService.info('AuthService', 'Redirecting to Bungie authorization', {
        authUrl: authUrl.replace(environment.bungie.clientId, '[REDACTED]')
      });
      
      window.location.href = authUrl;
    } catch (error) {
      this.isAuthenticating = false;
      this.loggingService.error(
        'AuthService', 
        'Failed to redirect to Bungie authorization',
        error,
        'AUTH_REDIRECT_FAILED',
        { browserInfo: navigator.userAgent }
      );
    }
  }

  public handleCallback(code: string): Observable<boolean> {
    this.loggingService.info('AuthService', 'Processing callback with authorization code');
    
    const redirectUrl = this.getRedirectUrl();
    this.loggingService.debug('AuthService', 'Using redirect URL for token exchange', { redirectUrl });
    
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('client_id', environment.bungie.clientId);
    body.set('client_secret', environment.bungie.clientSecret);
    body.set('redirect_uri', redirectUrl); // Must exactly match the initial request

    // Log the token request for debugging (not in production)
    this.loggingService.debug('AuthService', 'Token request details', {
      url: environment.bungie.tokenUrl,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-API-Key': '[REDACTED]',
        'Origin': this.getOrigin()
      },
      body: {
        grant_type: 'authorization_code',
        client_id: '[REDACTED]',
        has_client_secret: !!environment.bungie.clientSecret,
        redirect_uri: redirectUrl
      }
    });

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': environment.bungie.apiKey,
      'Origin': this.getOrigin()
    });

    return this.http.post<AuthToken>(
      environment.bungie.tokenUrl,
      body.toString(),
      { headers }
    ).pipe(
      tap(token => {
        this.loggingService.info('AuthService', 'Successfully obtained access token');
        this.storeToken(token);
      }),
      map(() => true),
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Failed to obtain access token';
        let errorDetails = {};
        
        if (error.error) {
          errorMessage = `Token exchange failed: ${error.error.error_description || error.error.error || 'Unknown error'}`;
          errorDetails = { 
            error: error.error.error,
            description: error.error.error_description,
            status: error.status,
            statusText: error.statusText
          };
        }
        
        this.loggingService.error(
          'AuthService',
          errorMessage,
          error,
          'AUTH_TOKEN_EXCHANGE_ERROR',
          {
            ...errorDetails,
            redirectUrl: redirectUrl,
            tokenUrl: environment.bungie.tokenUrl
          }
        );
        
        return throwError(() => new Error(errorMessage));
      }),
      finalize(() => {
        this.isAuthenticating = false;
      })
    );
  }

  public logout(): void {
    if (this.isBrowser()) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiry');
      localStorage.removeItem('membershipId');
      localStorage.removeItem('membershipType');
      localStorage.removeItem('characterId');
      sessionStorage.removeItem('auth_state');
    }
    
    this.currentUserSubject.next(null);
    
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    
    this.router.navigate(['/auth/login']);
  }

  private storeToken(token: AuthToken): void {
    if (this.isBrowser()) {
      localStorage.setItem('authToken', JSON.stringify(token));
      localStorage.setItem('refreshToken', token.refresh_token);
      localStorage.setItem('membershipId', token.membership_id);
      
      // Calculate expiration time
      const expiresIn = token.expires_in * 1000;
      const expiryTime = new Date().getTime() + expiresIn;
      localStorage.setItem('tokenExpiry', expiryTime.toString());
      
      // Set up automatic logout when token expires
      this.autoLogout(expiresIn);
    }
    
    this.getUserProfile().subscribe({
      next: user => {
        this.currentUserSubject.next(user);
        this.loggingService.info('AuthService', 'User profile loaded', {
          username: user.displayName
        });
      },
      error: err => {
        this.loggingService.error('AuthService', 'Failed to load user profile', err);
      }
    });
  }

  private autoLogout(expirationDuration: number): void {
    this.loggingService.debug('AuthService', 'Setting auto-logout timer', {
      expiresInMs: expirationDuration,
      expiresAt: new Date(Date.now() + expirationDuration).toISOString()
    });
    
    this.tokenExpirationTimer = setTimeout(() => {
      this.loggingService.info('AuthService', 'Token expired, logging out user');
      this.logout();
    }, expirationDuration);
  }

  private checkStoredToken(): void {
    if (this.isBrowser()) {
      const authDataString = localStorage.getItem('authToken');
      if (!authDataString) return;

      try {
        const token: AuthToken = JSON.parse(authDataString);
        const expiryTimeString = localStorage.getItem('tokenExpiry');
        
        if (!expiryTimeString) {
          this.logout();
          return;
        }
        
        const expiryTime = parseInt(expiryTimeString, 10);
        const now = new Date().getTime();
        
        if (expiryTime <= now) {
          this.loggingService.info('AuthService', 'Token has expired, logging out');
          this.logout();
          return;
        }
        
        // Set up auto-logout for the remaining time
        const timeRemaining = expiryTime - now;
        this.autoLogout(timeRemaining);
        
        // Load user profile
        this.getUserProfile().subscribe();
      } catch (error) {
        this.loggingService.error('AuthService', 'Failed to parse stored token', error);
        this.logout();
      }
    }
  }

  private getToken(): string {
    if (this.isBrowser()) {
      const authDataString = localStorage.getItem('authToken');
      if (authDataString) {
        try {
          const token: AuthToken = JSON.parse(authDataString);
          return token.access_token;
        } catch (error) {
          this.loggingService.error('AuthService', 'Failed to parse token', error);
        }
      }
    }
    return '';
  }

  private getUserProfile(): Observable<BungieUser> {
    const headers = new HttpHeaders({
      'X-API-Key': environment.bungie.apiKey,
      'Authorization': `Bearer ${this.getToken()}`
    });
    
    return this.http.get<{ Response: BungieUser }>(
      `${environment.bungie.apiRoot}/User/GetCurrentBungieNetUser/`,
      { headers }
    ).pipe(
      map(response => response.Response),
      tap(user => this.currentUserSubject.next(user))
    );
  }

  public getRedirectUrl(): string {
    // Use the configured static URL if available
    if (environment.bungie.redirectUrl) {
      return environment.bungie.redirectUrl;
    }
    
    const config = environment.bungie.redirectConfig;
    
    // If configured to use current host, build the URL from current location
    if (config?.useCurrentHost && this.isBrowser()) {
      const protocol = window.location.protocol.replace(':', '');
      const host = window.location.host; // Includes port if present
      return `${protocol}://${host}${config.path || '/auth/callback'}`;
    }
    
    // Otherwise use the configured values
    if (config) {
      const port = config.port ? `:${config.port}` : '';
      return `${config.protocol}://${config.host}${port}${config.path || '/auth/callback'}`;
    }
    
    // Last resort fallback
    return 'https://localhost:4433/auth/callback';
  }
  
  private getOrigin(): string {
    // Always use the registered origin, not the current one
    const config = environment.bungie.redirectConfig;
    
    if (config) {
      return `${config.protocol}://${config.host}${config.port ? `:${config.port}` : ''}`;
    }
    
    // Extract origin from redirectUrl as fallback
    if (environment.bungie.redirectUrl) {
      try {
        const url = new URL(environment.bungie.redirectUrl);
        return url.origin;
      } catch (e) {
        // URL parsing failed
      }
    }
    
    // Last resort fallback
    return 'https://localhost:4433';
  }
  
  private generateRandomState(): string {
    if (this.isBrowser()) {
      // Generate a random string for CSRF protection
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return '';
  }
}