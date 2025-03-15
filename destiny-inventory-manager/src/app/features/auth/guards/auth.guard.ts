import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router, 
  UrlTree 
} from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  
  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (this.isAuthenticated()) {
      return true;
    }
    
    // Navigate to the login page with extras
    return this.router.createUrlTree(['/auth/login']);
  }

  isAuthenticated(): boolean {
    // Only try to access localStorage in browser environments
    if (isPlatformBrowser(this.platformId)) {
      const authToken = localStorage.getItem('authToken');
      return authToken !== null;
    }
    
    // For server-side rendering, assume not authenticated
    // This allows the server to render the login page, and the client
    // will re-evaluate authentication when hydrated
    return false;
  }
}
