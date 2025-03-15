import { Injectable } from '@angular/core';
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
    private http: HttpClient,
    private router: Router
  ) {
    this.checkStoredToken();
  }

  public login(): void {
    const authUrl = `${environment.bungie.authUrl}?client_id=${environment.bungie.clientId}&response_type=code&redirect_uri=${encodeURIComponent(environment.bungie.redirectUrl)}`;
    window.location.href = authUrl;
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
    localStorage.removeItem('authToken');
    this.currentUserSubject.next(null);
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    this.router.navigate(['/auth/login']);
  }

  private storeToken(token: AuthToken): void {
    localStorage.setItem('authToken', JSON.stringify(token));
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

  private getToken(): string {
    const authData = localStorage.getItem('authToken');
    if (!authData) return '';
    
    const token: AuthToken = JSON.parse(authData);
    return token.access_token;
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
}
