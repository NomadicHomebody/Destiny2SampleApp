import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthToken, BungieUser } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<BungieUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenExpirationTimer: any;

  constructor(
    private http: HttpClient, // Direct injection instead of using inject()
    private router: Router,
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
    if (this.isBrowser()) {
        const redirectUrl = this.getRedirectUrl();
        const authUrl = `${environment.bungie.authUrl}?client_id=${environment.bungie.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}`;
        window.location.href = authUrl;
      }
  }

  public handleCallback(code: string): Observable<boolean> {
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('client_id', environment.bungie.clientId);
    body.set('client_secret', environment.bungie.clientSecret);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    return this.http.post<AuthToken>(
      environment.bungie.tokenUrl,
      body.toString(),
      { headers }
    ).pipe(
      tap(token => this.storeToken(token)),
      map(() => true),
      catchError(() => of(false))
    );
  }

  public logout(): void {
    if (this.isBrowser()) {
      localStorage.removeItem('authToken');
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
    }
    this.getUserProfile().subscribe(user => {
      this.currentUserSubject.next(user);
      const expiresIn = token.expires_in * 1000;
      this.autoLogout(expiresIn);
    });
  }

  private autoLogout(expirationDuration: number): void {
    this.tokenExpirationTimer = setTimeout(() => {
      this.logout();
    }, expirationDuration);
  }

  private checkStoredToken(): void {
    if (this.isBrowser()) {
      const authData = localStorage.getItem('authToken');
      if (!authData) return;

      const token: AuthToken = JSON.parse(authData);
      const now = new Date();
      const expirationDate = new Date(now.getTime() + token.expires_in * 1000);

      if (expirationDate <= now) {
        this.logout();
        return;
      }

      this.getUserProfile().subscribe();
    }
  }

  private getToken(): string {
    if (this.isBrowser()) {
      const authData = localStorage.getItem('authToken');
      if (authData) {
        const token: AuthToken = JSON.parse(authData);
        return token.access_token;
      }
    }
    return '';
  }

  private getUserProfile(): Observable<BungieUser> {
    return this.http.get<{ Response: BungieUser }>(
      `${environment.bungie.apiRoot}/User/GetCurrentBungieNetUser/`,
      {
        headers: new HttpHeaders({
          'X-API-Key': environment.bungie.apiKey,
          'Authorization': `Bearer ${this.getToken()}`
        })
      }
    ).pipe(
      map(response => response.Response),
      tap(user => this.currentUserSubject.next(user))
    );
  }

  private getRedirectUrl(): string {
    const config = environment.bungie.redirectConfig;
    
    // If configured to use current host, build the URL from current location
    if (config?.useCurrentHost && this.isBrowser()) {
      const protocol = window.location.protocol.replace(':', '');
      const host = window.location.host; // Includes port if present
      return `${protocol}://${host}${config.path || '/auth/callback'}`;
    }
    
    // Otherwise use the configured values or fall back to the static redirectUrl
    if (config) {
      const port = config.port ? `:${config.port}` : '';
      return `${config.protocol}://${config.host}${port}${config.path}`;
    }
    
    // Fall back to the static redirectUrl
    return environment.bungie.redirectUrl;
  }
}
