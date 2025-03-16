import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, finalize, retry, delay } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthToken, BungieUser } from '../models/auth.models';
import { LoggingService } from '../../../core/services/logging.service';

// Store processed auth codes to prevent reuse
const PROCESSED_CODES_KEY = 'processed_auth_codes';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<BungieUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenExpirationTimer: any;
  private isAuthenticating = false; // Flag to prevent concurrent auth attempts
  private profileLoadAttempted = false; // Flag to track profile loading attempts
  private inCallbackRoute = false; // Track if we're in the callback route

  constructor(
    private http: HttpClient,
    private router: Router,
    private loggingService: LoggingService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (this.isBrowser()) {
      // Check if we're in the callback route to avoid token validation during code exchange
      this.inCallbackRoute = this.isCallbackRoute();
      
      if (this.inCallbackRoute) {
        this.loggingService.debug('AuthService', 'Initializing auth service in callback route - skipping token validation');
      } else {
        this.loggingService.debug('AuthService', 'Initializing auth service - checking stored token');
        this.checkStoredToken();
      }
    }
  }

  /**
   * Check if we're currently in the callback route
   */
  private isCallbackRoute(): boolean {
    if (this.isBrowser()) {
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      
      // Check if we're in the callback route with a code parameter
      return (
        currentPath.includes('/auth/callback') && 
        currentSearch.includes('code=')
      );
    }
    return false;
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
      
      const authUrl = `${environment.bungie.authUrl}?client_id=${encodeURIComponent(String(environment.bungie.clientId))}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${state}`;
      
      this.loggingService.info('AuthService', 'Redirecting to Bungie authorization', {
        authUrl: authUrl.replace(String(environment.bungie.clientId), environment.bungie.clientSecret)
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

  /**
   * Check if a code has already been processed to prevent reuse
   */
  private hasCodeBeenProcessed(code: string): boolean {
    if (!this.isBrowser()) return false;
    
    try {
      const processedCodes = JSON.parse(sessionStorage.getItem(PROCESSED_CODES_KEY) || '[]');
      return processedCodes.includes(code);
    } catch (e) {
      this.loggingService.warn('AuthService', 'Error checking processed codes', e);
      return false;
    }
  }

  /**
   * Mark a code as processed to prevent reuse
   */
  private markCodeAsProcessed(code: string): void {
    if (!this.isBrowser()) return;
    
    try {
      const processedCodes = JSON.parse(sessionStorage.getItem(PROCESSED_CODES_KEY) || '[]');
      processedCodes.push(code);
      
      // Keep only the last 5 codes to prevent storage bloat
      if (processedCodes.length > 5) {
        processedCodes.shift();
      }
      
      sessionStorage.setItem(PROCESSED_CODES_KEY, JSON.stringify(processedCodes));
    } catch (e) {
      this.loggingService.warn('AuthService', 'Error marking code as processed', e);
    }
  }

  public handleCallback(code: string): Observable<boolean> {
    // Log authorization code details - mask part of it for security
    const maskedCode = code.length > 8 ? 
      code.substring(0, 4) + '...' + code.substring(code.length - 4) : 
      '[REDACTED]';
    
    this.loggingService.info('AuthService', 'Processing callback with authorization code', {
      inCallbackRoute: true,
      codeReceived: true,
      codeLength: code.length,
      maskedCode: maskedCode,
      receivedAt: new Date().toISOString(),
      currentUrl: this.isBrowser() ? window.location.href.replace(/code=([^&]+)/, 'code=[REDACTED]') : 'unknown'
    });
    
    // Check if this code has already been processed
    if (this.hasCodeBeenProcessed(code)) {
      this.loggingService.warn('AuthService', 'Authorization code has already been processed', {
        codeLength: code.length,
        maskedCode: maskedCode
      });
      return throwError(() => new Error('Authorization code has already been processed'));
    }
    
    // Mark this code as processed
    this.markCodeAsProcessed(code);
    
    const redirectUrl = this.getRedirectUrl();
    
    // Ensure client_id and client_secret are properly formatted as strings
    const clientId = String(environment.bungie.clientId).trim();
    const clientSecret = String(environment.bungie.clientSecret).trim();
    
    this.loggingService.debug('AuthService', 'Using redirect URL for token exchange', { 
      redirectUrl,
      clientIdLength: clientId.length,
      hasClientSecret: clientSecret.length > 0
    });
    
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('client_id', clientId);
    
    // Only include client_secret if it has a value
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }
    
    body.set('redirect_uri', redirectUrl); // Must exactly match the initial request

    // Log the actual HTTP request body (with sensitive data redacted)
    const bodyString = body.toString();
    const redactedBody = bodyString
      .replace(/client_id=([^&]+)/, 'client_id=[REDACTED]')
      .replace(/client_secret=([^&]+)/, 'client_secret=[REDACTED]')
      .replace(/code=([^&]+)/, 'code=[REDACTED]');
      
    this.loggingService.debug('AuthService', 'Token request body', {
      bodyString: redactedBody,
      contentLength: bodyString.length,
      requestTime: new Date().toISOString()
    });

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': environment.bungie.apiKey,
      'Origin': this.getOrigin()
    });

    // Log the specific details about the token request
    this.loggingService.debug('AuthService', 'Token request details', {
      url: environment.bungie.tokenUrl,
      headers: {
        contentType: 'application/x-www-form-urlencoded',
        apiKeyPresent: !!environment.bungie.apiKey,
        origin: this.getOrigin()
      },
      grantType: 'authorization_code',
      redirectUri: redirectUrl
    });

    return this.http.post<AuthToken>(
      environment.bungie.tokenUrl,
      bodyString,
      { headers }
    ).pipe(
      tap(token => {
        this.loggingService.info('AuthService', 'Successfully obtained access token', {
          tokenLength: token.access_token.length,
          expiresIn: token.expires_in,
          tokenType: token.token_type,
          hasMembershipId: !!token.membership_id
        });
        this.storeToken(token);
      }),
      map(() => true),
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Failed to obtain access token';
        let errorDetails: any = {};
        
        if (error.error) {
          errorMessage = `Token exchange failed: ${error.error.error_description || error.error.error || 'Unknown error'}`;
          errorDetails = { 
            error: error.error.error,
            description: error.error.error_description,
            status: error.status,
            statusText: error.statusText
          };
          
          // Special handling for client_id parsing errors
          if (error.error.error_description === 'Cannot parse client_id') {
            this.loggingService.error(
              'AuthService',
              'Client ID parsing error during token exchange',
              error,
              'AUTH_CLIENT_ID_ERROR',
              {
                clientIdType: typeof environment.bungie.clientId,
                clientIdLength: clientId.length,
                // Log first and last character to help diagnose formatting issues
                clientIdStart: clientId.charAt(0),
                clientIdEnd: clientId.charAt(clientId.length - 1)
              }
            );
          }
          
          // Special handling for invalid code errors
          if (error.error.error === 'invalid_grant' && error.error.error_description === 'AuthorizationCodeInvalid') {
            this.loggingService.error(
              'AuthService',
              'Invalid authorization code during token exchange',
              error,
              'AUTH_INVALID_CODE_ERROR',
              {
                codeLength: code.length,
                maskedCode: maskedCode,
                tokenExchangeDelay: this.calculateTimeSincePageLoad(),
                callbackTime: new Date().toISOString()
              }
            );
          }
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

  /**
   * Calculate time since page load to help diagnose code expiry issues
   */
  private calculateTimeSincePageLoad(): string {
    if (!this.isBrowser() || !window.performance) return 'unknown';
    
    try {
      const navigationStart = window.performance.timing.navigationStart;
      const now = Date.now();
      const timeSincePageLoad = now - navigationStart;
      
      return `${timeSincePageLoad}ms`;
    } catch (e) {
      return 'calculation error';
    }
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
      
      // Clear the processed codes storage
      sessionStorage.removeItem(PROCESSED_CODES_KEY);
    }
    
    this.currentUserSubject.next(null);
    this.profileLoadAttempted = false;
    
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    
    this.router.navigate(['/auth/login']);
  }

  private storeToken(token: AuthToken): void {
    if (this.isBrowser()) {
      // Store token data
      localStorage.setItem('authToken', token.access_token);
      localStorage.setItem('tokenType', token.token_type);
      localStorage.setItem('refreshToken', token.refresh_token);
      localStorage.setItem('membershipId', token.membership_id);
      
      // Store token object for debugging
      try {
        localStorage.setItem('tokenObject', JSON.stringify(token));
      } catch (e) {
        this.loggingService.warn('AuthService', 'Could not stringify token object', e);
      }
      
      // Calculate expiration time
      const expiresIn = token.expires_in * 1000;
      const expiryTime = new Date().getTime() + expiresIn;
      localStorage.setItem('tokenExpiry', expiryTime.toString());
      
      this.loggingService.info('AuthService', 'Token stored successfully', {
        hasMembershipId: !!token.membership_id,
        expiresIn: `${token.expires_in} seconds`,
        expiryTime: new Date(expiryTime).toISOString()
      });
      
      // Set up automatic logout when token expires
      this.autoLogout(expiresIn);
    }
    
    // Attempt to load the user profile with retry logic
    this.getUserProfile().pipe(
      retry({ count: 3, delay: 1000 }), // Retry 3 times with 1 second delay
    ).subscribe({
      next: user => {
        this.profileLoadAttempted = true;
        this.currentUserSubject.next(user);
        this.loggingService.info('AuthService', 'User profile loaded', {
          username: user.displayName,
          membershipId: user.membershipId
        });
      },
      error: err => {
        this.profileLoadAttempted = true;
        this.loggingService.warn('AuthService', 'Token obtained but profile loading failed', {
          hasMembershipId: !!token.membership_id
        });
        
        // Even if profile loading fails, we can safely navigate to vault 
        // as long as we have a valid token and membership ID
        if (token.membership_id) {
          this.router.navigate(['/vault']);
        }
      }
    });
  }

  private autoLogout(expirationDuration: number): void {
    this.loggingService.debug('AuthService', 'Setting auto-logout timer', {
      expiresInMs: expirationDuration,
      expiresAt: new Date(Date.now() + expirationDuration).toISOString(),
      currentRoute: this.isBrowser() ? window.location.pathname : 'unknown'
    });
    
    this.tokenExpirationTimer = setTimeout(() => {
      this.loggingService.info('AuthService', 'Token expired, logging out user');
      this.logout();
    }, expirationDuration);
  }

  private checkStoredToken(): void {
    if (this.isBrowser()) {
      // Skip token validation if we're in the callback route
      if (this.isCallbackRoute()) {
        this.loggingService.debug('AuthService', 'In callback route, skipping token validation');
        return;
      }
      
      const token = localStorage.getItem('authToken');
      const membershipId = localStorage.getItem('membershipId');
      const expiryTimeString = localStorage.getItem('tokenExpiry');
      
      if (!token || !membershipId || !expiryTimeString) {
        this.loggingService.debug('AuthService', 'Missing token data, cleaning up', {
          currentRoute: window.location.pathname + window.location.search,
          hasToken: !!token,
          hasMembershipId: !!membershipId,
          hasExpiryTime: !!expiryTimeString
        });
        this.logout();
        return;
      }
      
      try {
        const expiryTime = parseInt(expiryTimeString, 10);
        const now = new Date().getTime();
        
        if (expiryTime <= now) {
          this.loggingService.info('AuthService', 'Token has expired, logging out');
          this.logout();
          return;
        }
        
        this.loggingService.info('AuthService', 'Found valid token', {
          hasMembershipId: !!membershipId,
          expiresAt: new Date(expiryTime).toISOString(),
          currentRoute: window.location.pathname
        });
        
        // Set up auto-logout for the remaining time
        const timeRemaining = expiryTime - now;
        this.autoLogout(timeRemaining);
        
        // Load user profile if not already loaded
        if (!this.profileLoadAttempted) {
          this.getUserProfile().subscribe({
            error: err => {
              this.profileLoadAttempted = true;
              this.loggingService.warn('AuthService', 'Stored token valid but profile loading failed');
              // Don't logout, still let them use the app
            }
          });
        }
      } catch (error) {
        this.loggingService.error('AuthService', 'Failed to parse stored token data', error);
        this.logout();
      }
    }
  }

  public getToken(): string {
    if (this.isBrowser()) {
      return localStorage.getItem('authToken') || '';
    }
    return '';
  }

  public getMembershipId(): string | null {
    if (this.isBrowser()) {
      return localStorage.getItem('membershipId');
    }
    return null;
  }

  private getUserProfile(): Observable<BungieUser> {
    const token = this.getToken();
    const membershipId = this.getMembershipId();
    
    if (!token || !membershipId) {
      this.loggingService.warn('AuthService', 'Attempted to get user profile without valid token/membershipId');
      return throwError(() => new Error('No authentication token or membership ID available'));
    }
    
    const headers = new HttpHeaders({
      'X-API-Key': environment.bungie.apiKey,
      'Authorization': `Bearer ${token}`
    });
    
    this.loggingService.debug('AuthService', 'Requesting user profile', {
      url: `${environment.bungie.apiRoot}/User/GetCurrentBungieNetUser/`,
      hasMembershipId: !!membershipId,
      hasToken: !!token
    });
    
    return this.http.get<any>(
      `${environment.bungie.apiRoot}/User/GetCurrentBungieNetUser/`,
      { headers }
    ).pipe(
      tap(response => {
        this.loggingService.debug('AuthService', 'Got raw profile response', {
          hasResponse: !!response,
          responseKeys: response ? Object.keys(response) : [],
          hasResponseData: !!response?.Response
        });
      }),
      map(response => {
        if (!response || !response.Response) {
          throw new Error('Invalid profile response format');
        }
        return response.Response;
      }),
      tap(user => {
        if (!user.membershipId) {
          // If API didn't return membershipId, use the one from token
          user.membershipId = membershipId;
        }
        this.currentUserSubject.next(user);
      }),
      catchError((error: HttpErrorResponse) => {
        const statusCode = error.status;
        const errorBody = error.error;
        
        this.loggingService.error(
          'AuthService',
          `Failed to load user profile (HTTP ${statusCode})`,
          error,
          'USER_PROFILE_ERROR',
          {
            status: statusCode,
            errorBody: errorBody,
            membershipId: membershipId ? membershipId.substring(0, 5) + '...' : null
          }
        );
        
        // Create a basic user with just membership ID so app can function
        if (membershipId) {
          const fallbackUser: BungieUser = {
            membershipId: membershipId,
            displayName: 'Guardian',
            uniqueName: 'Guardian',
            membershipType: 0
          };
          
          this.loggingService.info('AuthService', 'Created fallback user profile', {
            membershipId: membershipId
          });
          
          this.currentUserSubject.next(fallbackUser);
          return of(fallbackUser);
        }
        
        return throwError(() => error);
      })
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