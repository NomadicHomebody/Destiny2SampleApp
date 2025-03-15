import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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

interface LogEmitterConfig {
  console?: boolean;
  remote?: boolean;
  file?: boolean;
}

interface FileLogConfig {
  enabled: boolean;
  path?: string;
  maxSize?: number;
  maxFiles?: number;
  compress?: boolean;
}

// Default log emitter configuration if environment doesn't specify
const DEFAULT_EMITTERS: LogEmitterConfig = {
  console: true,
  remote: false,
  file: false
};

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private readonly APP_VERSION = environment.logging?.appVersion || '1.0.0';
  private readonly remoteEndpoints: string[] = environment.logging?.remoteEndpoints || [];
  private readonly emitters: LogEmitterConfig;
  private readonly fileConfig: FileLogConfig;
  
  // For the in-memory log buffer used for file logging
  private logBuffer: LogEntry[] = [];
  private readonly bufferSize = 100; // Number of logs to buffer before writing to file
  private isWritingToFile = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Initialize emitter configuration from environment or use defaults
    this.emitters = environment.logging?.emitters || DEFAULT_EMITTERS;
    
    // Initialize file logging config
    this.fileConfig = environment.logging?.file || { enabled: false };
    
    // Log service initialization
    this.info('LoggingService', 'Logging service initialized', {
      emitters: this.emitters,
      fileConfig: this.fileConfig,
      remoteEndpointsCount: this.remoteEndpoints.length
    });
  }

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
    // Check if we should log this level based on environment configuration
    const minLevel = this.getMinLogLevel();
    if (!this.shouldLogLevel(level, minLevel)) {
      return;
    }
    
    const logEntry: LogEntry = this.buildLogEntry(level, source, message, error, code, additionalData);
    
    // Send to each enabled emitter
    if (this.emitters.console) {
      this.consoleLog(logEntry);
    }
    
    if (this.emitters.remote) {
      this.sendToEndpoints(logEntry);
    }
    
    if (this.emitters.file) {
      this.writeToLogFile(logEntry);
    }
    
    // Always store critical errors regardless of emitter settings
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
    this.log(LogLevel.DEBUG, source, message, null, undefined, additionalData);
  }

  /**
   * Get stored logs (for viewing in debug console)
   */
  public getStoredLogs(): LogEntry[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    
    try {
      const storedLogs = localStorage.getItem('error_logs');
      return storedLogs ? JSON.parse(storedLogs) : [];
    } catch (e) {
      console.error('Failed to retrieve stored logs:', e);
      return [];
    }
  }

  /**
   * Export logs to file for the user to download
   */
  public exportLogs(filename = 'application-logs.json'): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      const logs = this.getStoredLogs();
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      
      // Create download link and trigger it
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      
      this.info('LoggingService', 'Logs exported to file', { filename, logCount: logs.length });
    } catch (e) {
      console.error('Failed to export logs:', e);
    }
  }
  
  /**
   * Determine if a level should be logged based on minimum level setting
   */
  private shouldLogLevel(level: LogLevel, minLevel: LogLevel): boolean {
    const levelPriority: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.FATAL]: 4
    };
    
    return levelPriority[level] >= levelPriority[minLevel];
  }
  
  /**
   * Get minimum log level from environment or default to INFO
   */
  private getMinLogLevel(): LogLevel {
    const configLevel = environment.logging?.minLevel;
    if (configLevel && Object.values(LogLevel).includes(configLevel as LogLevel)) {
      return configLevel as LogLevel;
    }
    return environment.production ? LogLevel.INFO : LogLevel.DEBUG;
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
      // Don't include stack traces in production if configured that way
      const includeStack = environment.logging?.includeStacksInProduction || !environment.production;
      
      logEntry.technical = {
        name: error.name || (typeof error === 'object' ? error.constructor.name : typeof error),
        stack: includeStack ? error.stack : undefined,
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
    const formattedJson = environment.production 
      ? undefined // Don't output JSON in production to save console space
      : JSON.stringify(logEntry, null, 2);
    
    switch (logEntry.level) {
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(`%c[${logEntry.level}] ${logEntry.source}: ${logEntry.message}`, 'color: #e74c3c', 
          formattedJson ? '\n' + formattedJson : '');
        break;
      case LogLevel.WARN:
        console.warn(`%c[${logEntry.level}] ${logEntry.source}: ${logEntry.message}`, 'color: #f39c12', 
          formattedJson ? '\n' + formattedJson : '');
        break;
      case LogLevel.INFO:
        console.info(`%c[${logEntry.level}] ${logEntry.source}: ${logEntry.message}`, 'color: #3498db', 
          formattedJson ? '\n' + formattedJson : '');
        break;
      default:
        console.log(`%c[${logEntry.level}] ${logEntry.source}: ${logEntry.message}`, 'color: #7f8c8d', 
          formattedJson ? '\n' + formattedJson : '');
    }
  }

  /**
   * Send logs to multiple remote endpoints
   */
  private sendToEndpoints(logEntry: LogEntry): void {
    // Only send logs to server from browser environment
    if (!isPlatformBrowser(this.platformId) || this.remoteEndpoints.length === 0) {
      return;
    }
    
    // Create an array of HTTP requests, one for each endpoint
    const requests: Observable<any>[] = this.remoteEndpoints.map(endpoint => 
      this.http.post(endpoint, logEntry).pipe(
        catchError(error => {
          // Don't try to log this error to avoid potential infinite loops
          console.error(`Failed to send log to endpoint ${endpoint}:`, error);
          return of(null); // Return observable that doesn't error
        })
      )
    );
    
    // Use forkJoin to process all requests in parallel
    if (requests.length > 0) {
      forkJoin(requests).subscribe();
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
   * Write log entry to the file system
   * This uses a buffer approach to avoid frequent file operations
   */
  private writeToLogFile(logEntry: LogEntry): void {
    if (!isPlatformBrowser(this.platformId) || !this.fileConfig.enabled) {
      return;
    }
    
    // Add to buffer
    this.logBuffer.push(logEntry);
    
    // Write to file when buffer reaches threshold
    if (this.logBuffer.length >= this.bufferSize && !this.isWritingToFile) {
      this.flushLogBuffer();
    }
  }
  
  /**
   * Flush the log buffer to a file
   */
  private flushLogBuffer(): void {
    if (this.logBuffer.length === 0 || this.isWritingToFile) {
      return;
    }
    
    this.isWritingToFile = true;
    
    try {
      // Get logs to write
      const logsToWrite = [...this.logBuffer];
      this.logBuffer = [];
      
      // Format logs as JSON
      const logText = JSON.stringify(logsToWrite, null, 2);
      
      // In browser environment, we can't directly write to file system
      // So we'll create a file for download
      this.saveLogsToFile(logText);
    } catch (e) {
      console.error('Failed to write logs to file:', e);
    } finally {
      this.isWritingToFile = false;
    }
  }
  
  /**
   * Save logs to a file using available browser APIs
   */
  private saveLogsToFile(logText: string): void {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `app-logs-${timestamp}.json`;
    
    if (this.fileConfig.compress) {
      // If compression is enabled, use the compression library
      this.saveCompressedLogs(logText, filename);
    } else {
      // Otherwise save as regular JSON
      const blob = new Blob([logText], { type: 'application/json' });
      this.triggerDownload(blob, filename);
    }
  }
  
  /**
   * Save compressed logs
   */
  private saveCompressedLogs(logText: string, filename: string): void {
    // In a real implementation, you would use a library like pako for compression
    // For this example, we're simulating compression by just saving the file
    
    // Note: To actually implement compression, you'd add:
    // import * as pako from 'pako';
    // const compressed = pako.gzip(logText);
    // const blob = new Blob([compressed], { type: 'application/gzip' });
    
    // Simulate compression for this example
    console.log('Compressing logs (simulated)');
    const blob = new Blob([logText], { type: 'application/json' });
    this.triggerDownload(blob, filename + '.gz');
  }
  
  /**
   * Trigger file download
   */
  private triggerDownload(blob: Blob, filename: string): void {
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    
    // Add to document and trigger download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    this.consoleLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      source: 'LoggingService',
      message: `Logs saved to file: ${filename}`
    });
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