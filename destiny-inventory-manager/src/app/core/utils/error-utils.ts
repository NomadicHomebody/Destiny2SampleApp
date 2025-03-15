import { HttpErrorResponse } from '@angular/common/http';
import { throwError, Observable } from 'rxjs';
import { LoggingService, LogLevel } from '../services/logging.service';

/**
 * Standard error codes for application
 */
export enum ErrorCode {
  // Auth related errors
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  
  // API errors
  API_ERROR = 'API_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  API_UNREACHABLE = 'API_UNREACHABLE',
  
  // Destiny specific errors
  BUNGIE_API_ERROR = 'BUNGIE_API_ERROR',
  MANIFEST_ERROR = 'MANIFEST_ERROR',
  
  // Data errors
  INVALID_DATA = 'INVALID_DATA',
  MISSING_DATA = 'MISSING_DATA',
  
  // Feature errors
  VAULT_ERROR = 'VAULT_ERROR',
  INVENTORY_ERROR = 'INVENTORY_ERROR',
  EQUIPMENT_ERROR = 'EQUIPMENT_ERROR',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'
}

/**
 * Error handling utilities for consistent error processing throughout the app
 */
export class ErrorUtils {
  
  /**
   * Handle HTTP errors in a standardized way for service methods
   * 
   * @param error The error to handle
   * @param loggingService The logging service instance
   * @param source The source component/service name
   * @param friendlyMessage A user-friendly message
   * @param additionalData Any additional context
   * @returns An observable that throws the error after logging
   */
  public static handleHttpError(
    error: HttpErrorResponse,
    loggingService: LoggingService,
    source: string,
    friendlyMessage: string,
    additionalData?: any
  ): Observable<never> {
    // Determine error code
    let errorCode: string;
    
    if (error.status === 0) {
      errorCode = ErrorCode.API_UNREACHABLE;
    } else if (error.status === 401) {
      errorCode = ErrorCode.AUTH_UNAUTHORIZED;
    } else if (error.status === 408 || error.statusText === 'timeout') {
      errorCode = ErrorCode.API_TIMEOUT;
    } else if (error.error && error.error.ErrorCode) {
      // This is a Bungie specific error
      errorCode = `BUNGIE_${error.error.ErrorCode}`;
    } else {
      errorCode = `API_ERROR_${error.status}`;
    }
    
    // Log the error
    loggingService.error(
      source,
      friendlyMessage,
      error,
      errorCode,
      additionalData
    );
    
    // Return an observable that errors
    return throwError(() => ({
      code: errorCode,
      message: friendlyMessage,
      originalError: error
    }));
  }
  
  /**
   * Handle application errors (non-HTTP)
   * 
   * @param error The original error
   * @param loggingService The logging service
   * @param source The source component/service
   * @param friendlyMessage User-friendly message
   * @param errorCode Optional error code
   * @param additionalData Any additional context
   * @returns Observable that errors after logging
   */
  public static handleAppError(
    error: any,
    loggingService: LoggingService,
    source: string,
    friendlyMessage: string,
    errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    additionalData?: any
  ): Observable<never> {
    // Log the error
    loggingService.error(
      source,
      friendlyMessage,
      error,
      errorCode,
      additionalData
    );
    
    // Return an observable that errors
    return throwError(() => ({
      code: errorCode,
      message: friendlyMessage,
      originalError: error
    }));
  }
  
  /**
   * Check if an error is a specific Bungie API error code
   * 
   * @param error The error to check
   * @param bungieErrorCode The Bungie error code to check for
   * @returns True if the error matches the specified Bungie error code
   */
  public static isBungieError(error: any, bungieErrorCode: number): boolean {
    return error && 
           error.error && 
           typeof error.error === 'object' && 
           error.error.ErrorCode === bungieErrorCode;
  }
  
  /**
   * Extract the most meaningful message from an error
   * 
   * @param error Any type of error
   * @returns A string message that best represents the error
   */
  public static getErrorMessage(error: any): string {
    if (!error) {
      return 'Unknown error occurred';
    }
    
    // HttpErrorResponse
    if (error instanceof HttpErrorResponse) {
      // Try to get the most meaningful message from the error
      if (error.error) {
        // Bungie specific format
        if (error.error.Message) {
          return error.error.Message;
        }
        
        // Standard API error objects
        if (typeof error.error === 'object') {
          if (error.error.message) {
            return error.error.message;
          }
          if (error.error.error_description) {
            return error.error.error_description;
          }
        }
        
        // String error
        if (typeof error.error === 'string') {
          return error.error;
        }
      }
      
      // Generic HTTP error
      return `${error.status} ${error.statusText || 'Unknown HTTP Error'}`;
    }
    
    // String error
    if (typeof error === 'string') {
      return error;
    }
    
    // Object with message property
    if (error.message) {
      return error.message;
    }
    
    // Our standardized error format
    if (error.code && error.message) {
      return error.message;
    }
    
    // Last resort
    try {
      return JSON.stringify(error);
    } catch (e) {
      return String(error);
    }
  }
}