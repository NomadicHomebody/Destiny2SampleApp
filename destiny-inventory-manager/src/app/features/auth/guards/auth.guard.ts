import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router, 
  UrlTree 
} from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LoggingService } from '../../../core/services/logging.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  
  constructor(
    private router: Router,
    private authService: AuthService,
    private loggingService: LoggingService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const isAuthenticated = this.isAuthenticated();
    
    this.loggingService.debug('AuthGuard', 'Checking authentication status', {
      isAuthenticated,
      targetUrl: state.url
    });
    
    if (isAuthenticated) {
      return true;
    }
    
    // Navigate to the login page
    this.loggingService.warn('AuthGuard', 'Authentication required for route access', {
      targetUrl: state.url
    });
    return this.router.createUrlTree(['/auth/login']);
  }

  isAuthenticated(): boolean {
    // Only try to access localStorage in browser environments
    if (isPlatformBrowser(this.platformId)) {
      const authToken = localStorage.getItem('authToken');
      const tokenExpiry = localStorage.getItem('tokenExpiry');
      
      // Check if token exists and is not expired
      if (authToken && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry, 10);
        const now = new Date().getTime();
        
        if (expiryTime > now) {
          this.loggingService.debug('AuthGuard', 'Valid authentication token found');
          return true;
        } else {
          this.loggingService.debug('AuthGuard', 'Authentication token expired', {
            expiryTime: new Date(expiryTime).toISOString(),
            currentTime: new Date(now).toISOString()
          });
        }
      } else {
        this.loggingService.debug('AuthGuard', 'No valid authentication token found');
      }
      
      return authToken !== null;
    }
    
    // For server-side rendering, assume not authenticated
    // This allows the server to render the login page, and the client
    // will re-evaluate authentication when hydrated
    return false;
  }
}