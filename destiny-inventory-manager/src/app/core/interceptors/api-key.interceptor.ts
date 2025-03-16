import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable()
export class ApiKeyInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Check if this is a Bungie API request
    if (request.url.includes('bungie.net')) {
      // Build the origin based on the current environment
      const origin = this.getOrigin();
      
      // Don't modify the request if it already has these headers
      if (request.headers.has('X-API-Key') && request.headers.has('Origin')) {
        return next.handle(request);
      }
      
      // Clone the request and add the necessary headers
      return next.handle(request.clone({
        setHeaders: {
          // Only set these headers if they don't already exist
          'X-API-Key': request.headers.has('X-API-Key') ? 
            request.headers.get('X-API-Key')! : 
            environment.bungie.apiKey,
          'Origin': request.headers.has('Origin') ? 
            request.headers.get('Origin')! : 
            origin
        }
      }));
    }
    return next.handle(request);
  }
  
  private getOrigin(): string {
    // Use the configured redirect URL's origin from environment
    const config = environment.bungie.redirectConfig;
    if (config) {
      return `${config.protocol}://${config.host}${config.port ? `:${config.port}` : ''}`;
    }
    
    // Default fallback
    return 'https://localhost:4433';
  }
}