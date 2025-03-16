import { Injectable, Inject, PLATFORM_ID, Optional } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Observable, forkJoin, of, Subject, fromEvent } from 'rxjs';
import { catchError, filter, takeUntil, tap } from 'rxjs/operators';
import { DOCUMENT } from '@angular/common';
import * as pako from 'pako';

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
    isRetry?: boolean;      
    retryTimestamp?: string; 
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
  filters?: Record<string, any>;
}

interface LogEmitterConfig {
  console?: boolean;
  remote?: boolean;
  file?: boolean;
}

interface FileLogConfig {
  enabled: boolean;
  basePath?: string;
  folderNamePrefix?: string;
  maxSize?: number;
  maxFiles?: number;
  compress?: boolean;
  rotationPeriod?: 'hourly' | 'daily' | 'weekly';
  filenamePattern?: string;
}

interface OfflineConfig {
  enabled: boolean;
  maxBufferSize?: number;
  syncWhenOnline?: boolean;
}

interface LogFilters {
  excludeSources?: string[];
  custom?: Record<string, any>;
}

// Default log emitter configuration if environment doesn't specify
const DEFAULT_EMITTERS: LogEmitterConfig = {
  console: true,
  remote: false,
  file: false
};

// Default file config
const DEFAULT_FILE_CONFIG: FileLogConfig = {
  enabled: false,
  basePath: './data/logs/',
  folderNamePrefix: 'app-',
  maxSize: 10 * 1024 * 1024,
  maxFiles: 5,
  compress: true,
  rotationPeriod: 'daily',
  filenamePattern: '{prefix}log-{date}.json'
};

// Default offline config
const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  enabled: false,
  maxBufferSize: 50,
  syncWhenOnline: true
};

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private readonly APP_VERSION = environment.logging?.appVersion || '1.0.0';
  private readonly remoteEndpoints: string[] = environment.logging?.remoteEndpoints || [];
  private readonly emitters: LogEmitterConfig;
  private readonly fileConfig: FileLogConfig;
  private readonly offlineConfig: OfflineConfig;
  private readonly filters: LogFilters;
  
  // For the in-memory log buffer used for file logging
  private logBuffer: LogEntry[] = [];
  private readonly bufferSize = 100; // Number of logs to buffer before writing to file
  private isWritingToFile = false;
  
  // For offline logging
  private offlineBuffer: LogEntry[] = [];
  private isOnline = true;
  private readonly destroy$ = new Subject<void>();
  
  // For real-time log subscribers
  private logStream$ = new Subject<LogEntry>();

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Optional() @Inject(DOCUMENT) private document: Document
  ) {
    // Initialize emitter configuration from environment or use defaults
    this.emitters = environment.logging?.emitters || DEFAULT_EMITTERS;
    
    // Initialize file logging config
    // Create a properly typed rotation period value
    const rotationValue = environment.logging?.file?.rotationPeriod;
    const validRotationPeriods = ['daily', 'hourly', 'weekly'];
    const typedRotationPeriod = 
    validRotationPeriods.includes(rotationValue) 
    ? rotationValue as 'daily' | 'hourly' | 'weekly' 
    : undefined;

    // Create a properly typed configuration object
    const typedFileConfig: FileLogConfig = {
    ...DEFAULT_FILE_CONFIG,
    ...environment.logging?.file,
    rotationPeriod: typedRotationPeriod || DEFAULT_FILE_CONFIG.rotationPeriod
    };

this.fileConfig = typedFileConfig;
    // Initialize offline config
    this.offlineConfig = { ...DEFAULT_OFFLINE_CONFIG, ...environment.logging?.offline };
    
    // Initialize filters
    this.filters = environment.logging?.filters || {};
    
    // Setup online/offline detection
    if (isPlatformBrowser(this.platformId) && this.offlineConfig.enabled) {
      this.setupOfflineDetection();
    }
    
    // Register service worker if available and offline logging is enabled
    if (isPlatformBrowser(this.platformId) && this.offlineConfig.enabled) {
      this.registerServiceWorker();
    }
    
    // Log service initialization
    this.info('LoggingService', 'Logging service initialized', {
      emitters: this.emitters,
      fileConfig: this.fileConfig,
      remoteEndpointsCount: this.remoteEndpoints.length,
      offlineSupport: this.offlineConfig.enabled
    });
  }
  
  /**
   * Returns an observable that emits log entries as they are created
   */
  public getLogStream(): Observable<LogEntry> {
    return this.logStream$.asObservable();
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
    
    console.log(`DIRECT LOG: [${level}] ${source}: ${message}`); // Add this line
    
    // Check if we should log this level based on environment configuration
    const minLevel = this.getMinLogLevel();
    if (!this.shouldLogLevel(level, minLevel)) {
      return;
    }
    
    // Check if source is excluded
    if (this.filters.excludeSources && this.filters.excludeSources.includes(source)) {
      return;
    }
    
    const logEntry: LogEntry = this.buildLogEntry(level, source, message, error, code, additionalData);
    
    // Emit to any subscribers
    this.logStream$.next(logEntry);
    
    // Send to each enabled emitter
    if (this.emitters.console) {
      this.consoleLog(logEntry);
    }
    
    if (this.emitters.remote) {
      // Only send to remote if we're online
      if (isPlatformBrowser(this.platformId) && !this.isOnline && this.offlineConfig.enabled) {
        this.storeForOffline(logEntry);
      } else {
        this.sendToEndpoints(logEntry);
      }
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
      
      if (this.fileConfig.compress) {
        // Use pako for compression
        const logText = JSON.stringify(logs);
        const compressed = pako.gzip(logText);
        const blob = new Blob([compressed], { type: 'application/gzip' });
        
        this.triggerDownload(blob, filename + '.gz');
      } else {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        this.triggerDownload(blob, filename);
      }
      
      this.info('LoggingService', 'Logs exported to file', { 
        filename, 
        logCount: logs.length,
        compressed: this.fileConfig.compress
      });
    } catch (e) {
      console.error('Failed to export logs:', e);
    }
  }
  
  /**
   * Force sync any offline logs
   */
  public syncOfflineLogs(): void {
    if (!isPlatformBrowser(this.platformId) || !this.offlineConfig.enabled) return;
    
    this.processOfflineBuffer();
  }
  
  /**
   * Clean up resources when service is destroyed
   */
  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.logStream$.complete();
    
    // Flush any pending logs
    if (this.logBuffer.length > 0) {
      this.flushLogBuffer();
    }
  }
  
  /**
   * Setup offline detection
   */
  private setupOfflineDetection(): void {
    // Initialize based on current status
    this.isOnline = navigator.onLine;
    
    // Listen for online/offline events
    fromEvent(window, 'online').pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.isOnline = true;
      this.debug('LoggingService', 'Application is online');
      
      if (this.offlineConfig.syncWhenOnline) {
        this.processOfflineBuffer();
      }
    });
    
    fromEvent(window, 'offline').pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.isOnline = false;
      this.warn('LoggingService', 'Application is offline');
    });
  }
  
  /**
   * Register service worker for offline capabilities
   */
  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      // Note: In a real application, you would register your service worker here
      // For this example, we're just checking if it's available
      this.debug('LoggingService', 'Service Worker is available for offline logging');
    }
  }
  
  /**
   * Store log entry for offline processing later
   */
  private storeForOffline(logEntry: LogEntry): void {
    // Add to offline buffer
    this.offlineBuffer.push(logEntry);
    
    // Trim buffer if it exceeds max size
    const maxSize = this.offlineConfig.maxBufferSize || 50;
    if (this.offlineBuffer.length > maxSize) {
      this.offlineBuffer = this.offlineBuffer.slice(-maxSize);
    }
    
    // Store in IndexedDB or localStorage for persistence
    this.persistOfflineBuffer();
  }
  
  /**
   * Persist offline buffer to survive page reloads
   */
  private persistOfflineBuffer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      localStorage.setItem('offline_logs', JSON.stringify(this.offlineBuffer));
    } catch (e) {
      console.error('Failed to persist offline logs:', e);
    }
  }
  
  /**
   * Process the offline buffer when back online
   */
  private processOfflineBuffer(): void {
    if (this.offlineBuffer.length === 0) return;
    
    this.info('LoggingService', 'Processing offline log buffer', { count: this.offlineBuffer.length });
    
    // Process in batches to avoid overwhelming the network
    const batchSize = 10;
    const processBatch = () => {
      const batch = this.offlineBuffer.splice(0, batchSize);
      
      if (batch.length === 0) {
        // All processed
        this.persistOfflineBuffer();
        return;
      }
      
      // Process each log in the batch
      const requests = batch.map(logEntry => 
        this.sendToEndpoints(logEntry, true)
      );
      
      // Continue with next batch after this one is done
      forkJoin(requests).subscribe({
        next: () => {
          this.persistOfflineBuffer();
          setTimeout(processBatch, 1000); // Delay to prevent overwhelming the network
        },
        error: () => {
          // Put failed logs back in the buffer
          this.offlineBuffer = [...batch, ...this.offlineBuffer];
          this.persistOfflineBuffer();
        }
      });
    };
    
    // Start processing
    processBatch();
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
    
    // Add custom filters
    if (this.filters.custom) {
      logEntry.filters = { ...this.filters.custom };
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
  private sendToEndpoints(logEntry: LogEntry, isRetry: boolean = false): Observable<any> {
    // Only send logs to server from browser environment
    if (!isPlatformBrowser(this.platformId) || this.remoteEndpoints.length === 0) {
      return of(null);
    }
    
    // Add retry information if this is a retry attempt
    if (isRetry) {
      logEntry.context = {
        ...logEntry.context,
        isRetry: true,
        retryTimestamp: new Date().toISOString()
      };
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
      return forkJoin(requests);
    }
    
    return of(null);
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
      
      // Separate logs by level for level-based files if needed
      const logsByLevel: Record<LogLevel, LogEntry[]> = {
        [LogLevel.DEBUG]: [],
        [LogLevel.INFO]: [],
        [LogLevel.WARN]: [],
        [LogLevel.ERROR]: [],
        [LogLevel.FATAL]: []
      };
      
      // Group logs by level
      logsToWrite.forEach(log => {
        logsByLevel[log.level].push(log);
      });
      
      // Get the current date for folder naming
      const now = new Date();
      const dateString = this.formatDateForFilename(now);
      const folderName = `${this.fileConfig.folderNamePrefix || 'app-'}${dateString}`;
      
      // In a real Node.js environment, we would create the folder
      // but in browser we'll simulate this with structured downloads
      
      // Create a combined log file with all levels
      const allLogs = JSON.stringify(logsToWrite, null, 2);
      
      // Determine filename based on pattern
      const filename = this.formatFilename(dateString, 'all');
      
      if (this.fileConfig.compress) {
        // Use pako for compression
        const compressed = pako.gzip(allLogs);
        const blob = new Blob([compressed], { type: 'application/gzip' });
        
        this.triggerDownload(blob, `${folderName}/${filename}.gz`);
      } else {
        const blob = new Blob([allLogs], { type: 'application/json' });
        this.triggerDownload(blob, `${folderName}/${filename}`);
      }
      
      // Optionally create level-specific files
      // This would typically be based on configuration
      // For this example, we'll just create an error log separately
      if (logsByLevel[LogLevel.ERROR].length > 0 || logsByLevel[LogLevel.FATAL].length > 0) {
        const errorLogs = JSON.stringify([...logsByLevel[LogLevel.ERROR], ...logsByLevel[LogLevel.FATAL]], null, 2);
        const errorFilename = this.formatFilename(dateString, 'error');
        
        if (this.fileConfig.compress) {
          const compressed = pako.gzip(errorLogs);
          const blob = new Blob([compressed], { type: 'application/gzip' });
          
          this.triggerDownload(blob, `${folderName}/${errorFilename}.gz`);
        } else {
          const blob = new Blob([errorLogs], { type: 'application/json' });
          this.triggerDownload(blob, `${folderName}/${errorFilename}`);
        }
      }
      
      this.info('LoggingService', 'Logs saved to file', { 
        folder: folderName, 
        count: logsToWrite.length,
        compressed: this.fileConfig.compress
      });
    } catch (e) {
      console.error('Failed to write logs to file:', e);
      // Put logs back in buffer to try again later
      this.logBuffer = [...this.logBuffer, ...this.logBuffer];
    } finally {
      this.isWritingToFile = false;
    }
  }
  
  /**
   * Format date for filename
   */
  private formatDateForFilename(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  
  /**
   * Format filename based on pattern
   */
  private formatFilename(dateStr: string, level: string): string {
    let filename = this.fileConfig.filenamePattern || '{prefix}log-{date}-{level}.json';
    
    // Replace placeholders
    filename = filename
      .replace('{prefix}', this.fileConfig.folderNamePrefix || 'app-')
      .replace('{date}', dateStr)
      .replace('{level}', level);
      
    return filename;
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
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
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