import { ErrorHandler, Injectable, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { LoggingService, LogLevel } from '../services/logging.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  
  constructor(
    private loggingService: LoggingService,
    private zone: NgZone,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  handleError(error: Error | HttpErrorResponse): void {
    // Extract the most meaningful information from the error
    let errorToReport = error;
    let errorMessage = 'Unknown error';
    let errorCode: string | undefined;
    let source = 'GlobalErrorHandler';
    
    // Try to get the most useful message and categorize the error
    if (error instanceof HttpErrorResponse) {
      // HTTP errors should be handled by the interceptor, but as a fallback:
      errorMessage = `HTTP Error ${error.status}: ${error.message}`;
      errorCode = `HTTP_${error.status || 'UNKNOWN'}`;
      source = 'HttpError';
    } else {
      // Application errors
      errorMessage = error.message || String(error);
      
      // Try to identify known error types for better categorization
      if (error.name === 'ReferenceError') {
        errorCode = 'APP_REFERENCE_ERROR';
      } else if (error.name === 'TypeError') {
        errorCode = 'APP_TYPE_ERROR';
      } else if (error.name === 'SyntaxError') {
        errorCode = 'APP_SYNTAX_ERROR';
      } else if (error.name === 'RangeError') {
        errorCode = 'APP_RANGE_ERROR';
      } else if (error.name === 'SecurityError') {
        errorCode = 'SECURITY_VIOLATION';
      } else {
        // Try to identify error source from stack trace
        const stack = error.stack || '';
        if (stack.includes('auth/')) {
          source = 'AuthModule';
          errorCode = 'AUTH_ERROR';
        } else if (stack.includes('vault/')) {
          source = 'VaultModule';
          errorCode = 'VAULT_ERROR';
        } else {
          errorCode = 'APP_ERROR';
        }
      }
    }

    // Log the error with as much context as possible
    this.loggingService.error(
      source,
      errorMessage,
      errorToReport,
      errorCode,
      {
        currentRoute: this.router.url,
        appData: this.collectAppStateData()
      }
    );

    // For severe errors, we could navigate to an error page in the browser
    if (isPlatformBrowser(this.platformId) && this.isSevereError(error)) {
      this.zone.run(() => {
        // Store error details for the error page to display
        sessionStorage.setItem('lastError', JSON.stringify({
          message: errorMessage,
          timestamp: new Date().toISOString()
        }));
        
        // Only navigate for truly severe errors that prevent the app from functioning
        // this.router.navigate(['/error']);
      });
    }
  }

  /**
   * Determine if this is a severe error that should interrupt the user experience
   */
  private isSevereError(error: any): boolean {
    // Only consider severe errors that would prevent normal operation
    
    // HTTP errors generally don't need to interrupt UX
    if (error instanceof HttpErrorResponse) {
      // Only critical auth errors or complete API failures might warrant interruption
      // Check if error.url exists and then if it includes 'token'
      const isAuthTokenError = error.url ? error.url.includes('token') : false;
      return error.status === 0 || (error.status === 401 && isAuthTokenError);
    }
    
    // Check for signs of fatal app errors
    if (error && error.stack) {
      // Errors in core initialization
      if (typeof error.stack === 'string' && (
          error.stack.includes('ApplicationInitStatus') || 
          error.stack.includes('AppModule') ||
          error.stack.includes('main.ts'))) {
        return true;
      }
    }
    
    // By default, don't interrupt UX for most errors
    return false;
  }

  /**
   * Collect relevant application state data for better error context
   */
  private collectAppStateData(): any {
    if (!isPlatformBrowser(this.platformId)) {
      return { environment: 'server' };
    }
    
    // Collect important app state without including sensitive information
    const data: any = {};
    
    // Check if user is authenticated
    data.isAuthenticated = !!localStorage.getItem('authToken');
    
    // Get information about app routing state
    data.currentUrl = this.router.url;
    
    // Application display metrics
    if (window) {
      data.viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
    }
    
    return data;
  }
}