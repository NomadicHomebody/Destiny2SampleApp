import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { LoggingService, LogLevel } from '../services/logging.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  
  constructor(private loggingService: LoggingService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const startTime = Date.now();
    const reqMethod = request.method;
    const reqUrl = request.url;
    
    // Strip sensitive data like auth tokens from logs
    const safeUrl = this.sanitizeUrl(reqUrl);
    
    // For tracking the request completion
    let status: 'success' | 'error' = 'success';
    let errorResponse: HttpErrorResponse | null = null;

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        status = 'error';
        errorResponse = error;
        
        // Determine the error context
        const errorContext = this.getErrorContext(error);
        
        // Standard error codes for common scenarios
        let errorCode: string | undefined;
        if (error.status === 401) errorCode = 'AUTH_UNAUTHORIZED';
        else if (error.status === 403) errorCode = 'AUTH_FORBIDDEN';
        else if (error.status === 404) errorCode = 'API_NOT_FOUND';
        else if (error.status === 0) errorCode = 'API_UNREACHABLE';
        else if (error.status >= 500) errorCode = 'API_SERVER_ERROR';
        else errorCode = `API_ERROR_${error.status || 'UNKNOWN'}`;
        
        // Build detailed additional data
        const additionalData = {
          url: safeUrl,
          method: reqMethod,
          status: error.status,
          statusText: error.statusText,
          requestDuration: Date.now() - startTime,
          headers: this.getHeadersAsObject(request.headers),
          responseBody: this.sanitizeResponseBody(error.error),
          serviceName: this.extractApiServiceName(reqUrl),
          action: this.determineActionFromRequest(request)
        };
        
        // Log the error with our standardized format
        this.loggingService.error(
          'HttpInterceptor',
          `HTTP Error ${error.status}: ${errorContext.message || 'Unknown error'}`,
          error,
          errorCode,
          additionalData
        );
        
        // Still throw the error for the application to handle
        return throwError(() => error);
      }),
      finalize(() => {
        // Log successful requests at DEBUG level for development diagnostics
        if (status === 'success' && !environment.production) {
          this.loggingService.debug('HttpInterceptor', `HTTP ${reqMethod} ${safeUrl}`, {
            method: reqMethod,
            url: safeUrl,
            requestDuration: Date.now() - startTime
          });
        }
      })
    );
  }

  /**
   * Clean URLs of sensitive information for logging
   */
  private sanitizeUrl(url: string): string {
    try {
      // Remove API keys, tokens and other sensitive params from query strings
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      // List of sensitive parameter names to redact
      const sensitiveParams = ['key', 'token', 'api_key', 'apikey', 'password', 'secret', 'jwt'];
      
      sensitiveParams.forEach(param => {
        if (params.has(param)) {
          params.set(param, '[REDACTED]');
        }
      });
      
      // Check for auth tokens in paths like /auth/token/12345
      const pathSegments = urlObj.pathname.split('/');
      if (pathSegments.includes('token') || pathSegments.includes('auth')) {
        // If the path includes these segments, let's be cautious and only keep the API route
        // Keep first 3-4 segments that identify the resource, replace the rest
        const safePathLength = Math.min(4, pathSegments.length);
        const safePath = pathSegments.slice(0, safePathLength).join('/');
        
        if (safePath.length < urlObj.pathname.length) {
          urlObj.pathname = safePath + '/[REDACTED]';
        }
      }
      
      return urlObj.toString();
    } catch (e) {
      // If URL parsing fails, do basic redaction on the string
      return url.replace(/([?&](key|token|api_key|apikey|password|secret|jwt)=)[^&]+/gi, '$1[REDACTED]');
    }
  }

  /**
   * Extract meaningful error context from various error response formats
   */
  private getErrorContext(error: HttpErrorResponse): { message: string, code?: string } {
    if (!error) {
      return { message: 'Unknown error' };
    }
    
    // Try to extract Bungie API specific error format first
    if (error.error && typeof error.error === 'object') {
      // Bungie API format
      if (error.error.ErrorCode !== undefined && error.error.Message) {
        return { 
          message: error.error.Message,
          code: `BUNGIE_${error.error.ErrorCode}`
        };
      }
      
      // Standard API error with message field
      if (error.error.message) {
        return { message: error.error.message };
      }
      
      // Error object with string error description
      if (error.error.error || error.error.error_description) {
        return { 
          message: error.error.error_description || error.error.error 
        };
      }
    }
    
    // Use Angular's provided error message as fallback
    return { 
      message: error.message || `HTTP Error ${error.status}` 
    };
  }

  /**
   * Convert headers to a simple object for logging
   */
  private getHeadersAsObject(headers: any): {[key: string]: string} {
    const result: {[key: string]: string} = {};
    
    if (headers && typeof headers.keys === 'function') {
      const headerKeys = headers.keys();
      
      for (const key of headerKeys) {
        // Don't log sensitive headers like Authorization
        if (!['authorization', 'x-api-key', 'cookie'].includes(key.toLowerCase())) {
          result[key] = headers.get(key);
        } else {
          result[key] = '[REDACTED]';
        }
      }
    }
    
    return result;
  }

  /**
   * Sanitize response body for safe logging
   */
  private sanitizeResponseBody(body: any): any {
    if (!body) return undefined;
    
    // For string responses, truncate if too long
    if (typeof body === 'string') {
      return body.length > 500 ? body.substring(0, 500) + '...' : body;
    }
    
    // For objects, try to sanitize and return
    try {
      // Make a copy to sanitize
      const sanitized = JSON.parse(JSON.stringify(body));
      
      // Remove potentially sensitive fields
      const sensitiveFields = ['token', 'password', 'secret', 'key', 'authorization'];
      
      const deepSanitize = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        Object.keys(obj).forEach(key => {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object') {
            deepSanitize(obj[key]);
          }
        });
      };
      
      deepSanitize(sanitized);
      return sanitized;
    } catch (e) {
      return { error: 'Error sanitizing response body' };
    }
  }

  /**
   * Extract API service name from URL for better categorization
   */
  private extractApiServiceName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      // For Bungie API, use more specific categorization
      if (url.includes('bungie.net')) {
        if (pathParts.length > 1) {
          if (pathParts[0] === 'Platform') {
            return `Bungie.${pathParts[1]}`;
          }
          return `Bungie.${pathParts[0]}`;
        }
        return 'Bungie.API';
      }
      
      // For other APIs, try to extract service name from path
      if (pathParts.length > 0) {
        return pathParts[0];
      }
      
      return 'UnknownService';
    } catch (e) {
      return 'UnknownService';
    }
  }

  /**
   * Try to determine what action was being performed based on the request
   */
  private determineActionFromRequest(request: HttpRequest<unknown>): string {
    const method = request.method.toUpperCase();
    const url = request.url.toLowerCase();
    
    // Auth related
    if (url.includes('/oauth/token')) return 'AUTH_GET_TOKEN';
    if (url.includes('/auth/')) return 'AUTHENTICATION';
    
    // Bungie API specific actions
    if (url.includes('/destiny2/')) {
      if (url.includes('/profile/')) return 'FETCH_PROFILE';
      if (url.includes('/character/')) return 'FETCH_CHARACTER';
      if (url.includes('/item/')) return 'FETCH_ITEM';
      if (url.includes('/vault/')) return 'ACCESS_VAULT';
      return 'DESTINY2_API';
    }
    
    // Generic HTTP action based on method
    switch (method) {
      case 'GET': return 'FETCH_DATA';
      case 'POST': return 'CREATE_DATA';
      case 'PUT':
      case 'PATCH': return 'UPDATE_DATA';
      case 'DELETE': return 'DELETE_DATA';
      default: return 'API_REQUEST';
    }
  }
}

import { environment } from '../../../environments/environment';