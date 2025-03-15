import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { LoggingService, LogEntry, LogLevel } from '../../services/logging.service';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-debug-console',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="debug-console" *ngIf="visible">
      <div class="debug-header">
        <h3>Debug Console</h3>
        <div class="debug-actions">
          <button (click)="clearLogs()" class="clear-btn">Clear</button>
          <button (click)="copyLogs()" class="copy-btn">Copy</button>
          <button (click)="exportLogs()" class="export-btn">Export</button>
          <button (click)="toggleVisible()" class="close-btn">Close</button>
        </div>
      </div>
      <div class="debug-filters">
        <label>
          <input type="checkbox" [checked]="showLevel[logLevels.ERROR]" 
                (change)="toggleLevel(logLevels.ERROR)">
          Errors
        </label>
        <label>
          <input type="checkbox" [checked]="showLevel[logLevels.WARN]" 
                (change)="toggleLevel(logLevels.WARN)">
          Warnings
        </label>
        <label>
          <input type="checkbox" [checked]="showLevel[logLevels.INFO]" 
                (change)="toggleLevel(logLevels.INFO)">
          Info
        </label>
        <label>
          <input type="checkbox" [checked]="showLevel[logLevels.DEBUG]" 
                (change)="toggleLevel(logLevels.DEBUG)">
          Debug
        </label>
        
        <div class="emitter-status">
          <span class="emitter-label">Emitters:</span>
          <span class="emitter-badge" [class.active]="emitters.console">Console</span>
          <span class="emitter-badge" [class.active]="emitters.remote">Remote</span>
          <span class="emitter-badge" [class.active]="emitters.file">File</span>
        </div>
      </div>
      <div class="debug-content">
        <div *ngFor="let log of filteredLogs" class="log-entry" [ngClass]="'level-' + log.level.toLowerCase()">
          <div class="log-header" (click)="toggleExpanded(log)">
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span class="log-level">{{ log.level }}</span>
            <span class="log-source">{{ log.source }}</span>
            <span class="log-message">{{ log.message }}</span>
            <span class="expand-icon">{{ log.expanded ? '▼' : '►' }}</span>
          </div>
          <div class="log-details" *ngIf="log.expanded">
            <pre>{{ formatLogEntry(log) }}</pre>
          </div>
        </div>
        <div *ngIf="filteredLogs.length === 0" class="no-logs">
          No logs to display
        </div>
      </div>
      <div class="config-info">
        <span>Min Level: <strong>{{ minLogLevel }}</strong></span>
        <span>App Version: <strong>{{ appVersion }}</strong></span>
      </div>
    </div>
    <div class="debug-trigger" (click)="toggleVisible()" *ngIf="!visible">
      Debug <span class="log-count" *ngIf="logs.length">{{ logs.length }}</span>
    </div>
  `,
  styles: [`
    .debug-console {
      position: fixed;
      bottom: 0;
      right: 0;
      width: 80%;
      max-width: 800px;
      height: 60%;
      background-color: rgba(20, 20, 20, 0.95);
      color: #f5f5f5;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      border-top-left-radius: 6px;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
      font-family: monospace;
      transition: all 0.3s ease;
    }
    
    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      background-color: #333;
      border-top-left-radius: 6px;
    }
    
    .debug-header h3 {
      margin: 0;
      font-size: 1rem;
    }
    
    .debug-actions {
      display: flex;
      gap: 0.5rem;
    }
    
    .debug-actions button {
      padding: 0.25rem 0.5rem;
      background-color: #444;
      border: none;
      border-radius: 3px;
      color: #fff;
      cursor: pointer;
      font-size: 0.8rem;
    }
    
    .clear-btn:hover {
      background-color: #d35400;
    }
    
    .copy-btn:hover, .export-btn:hover {
      background-color: #3498db;
    }
    
    .close-btn:hover {
      background-color: #c0392b;
    }
    
    .debug-filters {
      display: flex;
      gap: 1rem;
      padding: 0.5rem 1rem;
      background-color: #222;
      border-bottom: 1px solid #444;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .debug-filters label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      cursor: pointer;
    }
    
    .emitter-status {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .emitter-label {
      font-size: 0.8rem;
      color: #aaa;
    }
    
    .emitter-badge {
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
      background-color: #333;
      color: #999;
      font-size: 0.7rem;
    }
    
    .emitter-badge.active {
      background-color: #2ecc71;
      color: #fff;
    }
    
    .debug-content {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
    }
    
    .log-entry {
      margin-bottom: 0.5rem;
      border-radius: 3px;
      overflow: hidden;
    }
    
    .log-header {
      display: flex;
      padding: 0.5rem;
      cursor: pointer;
      font-size: 0.9rem;
      align-items: center;
    }
    
    .log-header:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .log-time {
      margin-right: 0.5rem;
      font-size: 0.8rem;
      color: #aaa;
      width: 70px;
    }
    
    .log-level {
      margin-right: 0.5rem;
      font-weight: bold;
      width: 60px;
    }
    
    .log-source {
      margin-right: 0.5rem;
      color: #aaa;
      width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .log-message {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .expand-icon {
      margin-left: 0.5rem;
      font-size: 0.8rem;
      color: #aaa;
    }
    
    .log-details {
      padding: 0.5rem;
      background-color: #2a2a2a;
      border-top: 1px solid #444;
      font-size: 0.8rem;
      overflow-x: auto;
    }
    
    .log-details pre {
      margin: 0;
      white-space: pre-wrap;
    }
    
    .level-error {
      background-color: rgba(231, 76, 60, 0.2);
    }
    
    .level-error .log-level {
      color: #e74c3c;
    }
    
    .level-warn {
      background-color: rgba(243, 156, 18, 0.2);
    }
    
    .level-warn .log-level {
      color: #f39c12;
    }
    
    .level-info {
      background-color: rgba(52, 152, 219, 0.2);
    }
    
    .level-info .log-level {
      color: #3498db;
    }
    
    .level-debug {
      background-color: rgba(127, 140, 141, 0.2);
    }
    
    .level-debug .log-level {
      color: #7f8c8d;
    }
    
    .no-logs {
      text-align: center;
      padding: 1rem;
      color: #aaa;
      font-style: italic;
    }
    
    .config-info {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 1rem;
      background-color: #222;
      border-top: 1px solid #444;
      font-size: 0.8rem;
      color: #aaa;
    }
    
    .debug-trigger {
      position: fixed;
      bottom: 10px;
      right: 10px;
      padding: 5px 10px;
      background-color: rgba(20, 20, 20, 0.7);
      color: #f5f5f5;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.8rem;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .debug-trigger:hover {
      background-color: rgba(20, 20, 20, 0.9);
    }
    
    .log-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      background-color: #e74c3c;
      color: white;
      border-radius: 9px;
      font-size: 0.7rem;
      padding: 0 4px;
    }
  `]
})
export class DebugConsoleComponent implements OnInit, OnDestroy {
  // Store a reference to LogLevel enum for template usage
  logLevels = LogLevel;
  
  // Logs storage
  logs: Array<LogEntry & { expanded: boolean }> = [];
  filteredLogs: Array<LogEntry & { expanded: boolean }> = [];
  
  // Display filters
  showLevel: Record<LogLevel, boolean> = {
    [LogLevel.DEBUG]: true,
    [LogLevel.INFO]: true,
    [LogLevel.WARN]: true,
    [LogLevel.ERROR]: true,
    [LogLevel.FATAL]: true
  };
  
  // UI state
  visible = false;
  
  // Environment configuration
  minLogLevel = environment.logging?.minLevel || 'DEBUG';
  appVersion = environment.logging?.appVersion || '1.0.0';
  emitters = {
    console: environment.logging?.emitters?.console || true,
    remote: environment.logging?.emitters?.remote || false,
    file: environment.logging?.emitters?.file || false
  };
  
  // Subscriptions
  private subscription = new Subscription();
  
  constructor(
    private loggingService: LoggingService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Only enable in non-production and only in browser environment
    if (!environment.production && isPlatformBrowser(this.platformId)) {
      // Load logs from localStorage
      this.loadSavedLogs();
      
      // Show by default in dev mode or if there are errors
      this.visible = !environment.production && 
        (this.logs.some(log => log.level === LogLevel.ERROR) || 
        this.logs.some(log => log.level === LogLevel.FATAL));
      
      this.applyFilters();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  toggleVisible(): void {
    this.visible = !this.visible;
  }

  toggleLevel(level: LogLevel): void {
    this.showLevel[level] = !this.showLevel[level];
    this.applyFilters();
  }

  toggleExpanded(log: LogEntry & { expanded: boolean }): void {
    log.expanded = !log.expanded;
  }

  clearLogs(): void {
    this.logs = [];
    this.applyFilters();
    
    // Clear local storage - only in browser
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('error_logs');
    }
  }

  copyLogs(): void {
    // Only works in browser
    if (!isPlatformBrowser(this.platformId)) return;
    
    const logText = this.logs
      .filter(log => this.showLevel[log.level])
      .map(log => JSON.stringify(log, null, 2))
      .join('\n\n');
    
    navigator.clipboard.writeText(logText)
      .then(() => {
        // For visual feedback, we could flash a message
        console.log('Logs copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy logs: ', err);
      });
  }
  
  exportLogs(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loggingService.exportLogs();
    }
  }

  formatTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (e) {
      return 'Invalid time';
    }
  }

  formatLogEntry(log: LogEntry): string {
    // Create a copy without potentially circular references for clean JSON output
    const cleanLog = { ...log };
    delete (cleanLog as any).expanded;
    
    return JSON.stringify(cleanLog, null, 2);
  }

  private loadSavedLogs(): void {
    // Only try to access localStorage in browser environment
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      // Use the loggingService to get stored logs
      const storedLogs = this.loggingService.getStoredLogs();
      this.logs = storedLogs.map((log: LogEntry) => ({
        ...log,
        expanded: false
      }));
    } catch (e) {
      console.error('Failed to load saved logs:', e);
    }
  }

  private applyFilters(): void {
    this.filteredLogs = this.logs.filter(log => this.showLevel[log.level]);
  }
}