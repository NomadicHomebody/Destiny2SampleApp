import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  code?: string;
  context?: {
    url?: string;
    route?: string; 
    user?: any;
    action?: string;
    additionalData?: any;
  };
  technical?: {
    name?: string;
    stack?: string;
    rawError?: any;
  };
  metadata?: {
    browser?: string;
    os?: string;
    appVersion?: string;
    deviceInfo?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private readonly APP_VERSION = environment.logging?.appVersion || '1.0.0';
  private logEndpoint = environment.logging?.remoteEndpoint || '/api/logs';

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /**
   * Log a message with the specified level and optional details
   */
  public log(
    level: LogLevel, 
    source: string, 
    message: string, 
    error?: Error | any, 
    code?: string,
    additionalData?: any
  ): void {
    const logEntry: LogEntry = this.buildLogEntry(level, source, message, error, code, additionalData);
    
    // Print to console in development
    this.consoleLog(logEntry);
    
    // Send to server if in production or explicitly requested
    if ((environment.logging?.enableRemote || false) || level === LogLevel.ERROR || level === LogLevel.FATAL) {
      this.sendToServer(logEntry);
    }
    
    // Store critical errors for analytics
    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      this.storeForAnalytics(logEntry);
    }
  }

  /**
   * Log an error message
   */
  public error(source: string, message: string, error?: Error | any, code?: string, additionalData?: any): void {
    this.log(LogLevel.ERROR, source, message, error, code, additionalData);
  }

  /**
   * Log a warning message
   */
  public warn(source: string, message: string, error?: Error | any, code?: string, additionalData?: any): void {
    this.log(LogLevel.WARN, source, message, error, code, additionalData);
  }

  /**
   * Log an info message
   */
  public info(source: string, message: string, additionalData?: any): void {
    this.log(LogLevel.INFO, source, message, null, undefined, additionalData);
  }

  /**
   * Log a debug message (only in development)
   */
  public debug(source: string, message: string, additionalData?: any): void {
    if (!environment.production) {
      this.log(LogLevel.DEBUG, source, message, null, undefined, additionalData);
    }
  }

  /**
   * Build a structured log entry with all relevant information
   */
  private buildLogEntry(
    level: LogLevel, 
    source: string, 
    message: string, 
    error?: Error | any, 
    code?: string,
    additionalData?: any
  ): LogEntry {
    const now = new Date();
    const logEntry: LogEntry = {
      timestamp: now.toISOString(),
      level,
      source,
      message,
      code
    };

    // Add context info
    logEntry.context = {
      url: isPlatformBrowser(this.platformId) ? window.location.href : undefined,
      route: this.router.url,
      action: additionalData?.action,
      additionalData: additionalData
    };

    // Add user info if available
    if (isPlatformBrowser(this.platformId)) {
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        try {
          // Don't include the full token, just user identifier info
          const membershipId = localStorage.getItem('membershipId');
          logEntry.context.user = { membershipId };
        } catch (e) {
          // If parsing fails, don't include user info
        }
      }
    }

    // Add error details if present
    if (error) {
      logEntry.technical = {
        name: error.name || (typeof error === 'object' ? error.constructor.name : typeof error),
        stack: error.stack,
        rawError: this.sanitizeErrorObject(error)
      };
    }

    // Add device/browser metadata
    if (isPlatformBrowser(this.platformId)) {
      logEntry.metadata = {
        appVersion: this.APP_VERSION,
        browser: this.getBrowserInfo(),
        os: this.getOSInfo(),
        deviceInfo: this.getDeviceInfo()
      };
    }

    return logEntry;
  }

  /**
   * Sanitize error object for safe logging (remove sensitive data, circular refs)
   */
  private sanitizeErrorObject(error: any): any {
    if (!error) return error;
    
    // Handle non-object errors
    if (typeof error !== 'object') return { value: error };
    
    try {
      // Convert to JSON and back to strip functions and break circular references
      return JSON.parse(JSON.stringify(error, (key, value) => {
        // Exclude sensitive fields
        if (['password', 'token', 'secret', 'key', 'authorization', 'authToken'].includes(key.toLowerCase())) {
          return '[REDACTED]';
        }
        return value;
      }));
    } catch (e) {
      // If JSON serialization fails, return a simpler object
      return { 
        errorMessage: error.message || 'Unknown error',
        errorName: error.name || 'Error' 
      };
    }
  }

  /**
   * Console output for development purposes
   */
  private consoleLog(logEntry: LogEntry): void {
    if (!environment.production || logEntry.level === LogLevel.ERROR || logEntry.level === LogLevel.FATAL) {
      const formattedJson = JSON.stringify(logEntry, null, 2);
      
      switch (logEntry.level) {
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(`%c[${logEntry.level}] ${logEntry.source}: ${logEntry.message}`, 'color: #e74c3c', '\n', formattedJson);
          break;
        case LogLevel.WARN:
          console.warn(`%c[${logEntry.level}] ${logEntry.source}: ${logEntry.message}`, 'color: #f39c12', '\n', formattedJson);
          break;
        case LogLevel.INFO:
          console.info(`%c[${logEntry.level}] ${logEntry.source}: ${logEntry.message}`, 'color: #3498db', '\n', formattedJson);
          break;
        default:
          console.log(`%c[${logEntry.level}] ${logEntry.source}: ${logEntry.message}`, 'color: #7f8c8d', '\n', formattedJson);
      }
    }
  }

  /**
   * Send logs to the server API
   */
  private sendToServer(logEntry: LogEntry): void {
    // Only send logs to server from browser environment
    if (isPlatformBrowser(this.platformId)) {
      // Use HTTP client to send logs to your backend
      this.http.post(this.logEndpoint, logEntry).subscribe({
        error: (err) => {
          // Don't try to log this error to avoid potential infinite loops
          console.error('Failed to send log to server:', err);
        }
      });
    }
  }

  /**
   * Store critical errors for later analysis or sending when online
   */
  private storeForAnalytics(logEntry: LogEntry): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      // Get existing logs
      const storedLogs = localStorage.getItem('error_logs') || '[]';
      const logs = JSON.parse(storedLogs);
      
      // Add new log, limit to most recent logs (from config or default 50)
      logs.push(logEntry);
      const maxLogs = environment.logging?.maxStoredLogs || 50;
      if (logs.length > maxLogs) {
        logs.shift(); // Remove oldest
      }
      
      // Save back to storage
      localStorage.setItem('error_logs', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to store error log locally:', e);
    }
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): string {
    if (!isPlatformBrowser(this.platformId)) return 'server';
    
    const userAgent = navigator.userAgent;
    let browserInfo = 'unknown';
    
    if (userAgent.indexOf('Firefox') > -1) {
      browserInfo = 'Firefox';
    } else if (userAgent.indexOf('Chrome') > -1) {
      browserInfo = 'Chrome';
    } else if (userAgent.indexOf('Safari') > -1) {
      browserInfo = 'Safari';
    } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) {
      browserInfo = 'Internet Explorer';
    } else if (userAgent.indexOf('Edge') > -1) {
      browserInfo = 'Edge';
    }
    
    return browserInfo;
  }

  /**
   * Get OS information
   */
  private getOSInfo(): string {
    if (!isPlatformBrowser(this.platformId)) return 'server';
    
    const userAgent = navigator.userAgent;
    let osInfo = 'unknown';
    
    if (userAgent.indexOf('Windows') > -1) {
      osInfo = 'Windows';
    } else if (userAgent.indexOf('Mac') > -1) {
      osInfo = 'MacOS';
    } else if (userAgent.indexOf('Linux') > -1) {
      osInfo = 'Linux';
    } else if (userAgent.indexOf('Android') > -1) {
      osInfo = 'Android';
    } else if (userAgent.indexOf('iOS') > -1 || 
              (userAgent.indexOf('iPhone') > -1) || 
              (userAgent.indexOf('iPad') > -1)) {
      osInfo = 'iOS';
    }
    
    return osInfo;
  }

  /**
   * Get device information
   */
  private getDeviceInfo(): string {
    if (!isPlatformBrowser(this.platformId)) return 'server';
    
    const userAgent = navigator.userAgent;
    let deviceInfo = 'desktop';
    
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      deviceInfo = 'tablet';
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/.test(userAgent)) {
      deviceInfo = 'mobile';
    }
    
    return deviceInfo;
  }
}