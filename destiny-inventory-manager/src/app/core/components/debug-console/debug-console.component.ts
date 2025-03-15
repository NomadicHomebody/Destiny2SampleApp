import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoggingService, LogEntry, LogLevel } from '../../services/logging.service';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

import { EnhancedLogEntry, ExportOptions, FileConfig } from './models/debug-console.models';
import { LogsTabComponent } from './components/logs-tab/logs-tab.component';
import { FilesTabComponent } from './components/files-tab/files-tab.component';
import { SettingsTabComponent } from './components/settings-tab/settings-tab.component';
import { DebugConsoleService } from './services/debug-console.service';

@Component({
  selector: 'app-debug-console',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    LogsTabComponent,
    FilesTabComponent,
    SettingsTabComponent
  ],
  templateUrl: './debug-console.component.html',
  styleUrls: ['./debug-console.component.css']
})
export class DebugConsoleComponent implements OnInit, OnDestroy {
  // Store a reference to LogLevel enum for template usage
  logLevels = LogLevel;
  objectKeys = Object.keys;
  
  // Logs storage
  logs: EnhancedLogEntry[] = [];
  filteredLogs: EnhancedLogEntry[] = [];
  
  // Display filters
  showLevel: Record<LogLevel, boolean> = {
    [LogLevel.DEBUG]: true,
    [LogLevel.INFO]: true,
    [LogLevel.WARN]: true,
    [LogLevel.ERROR]: true,
    [LogLevel.FATAL]: true
  };
  
  sourceFilter = '';
  
  // UI state
  visible = false;
  activeTab = 'logs';
  currentTime = '';
  timeInterval: any;
  isOnline = true;
  
  // Configuration from environment
  appVersion = environment.logging?.appVersion || '1.0.0';
  minLogLevel = environment.logging?.minLevel || 'DEBUG';
  emitters = {
    console: environment.logging?.emitters?.console || true,
    remote: environment.logging?.emitters?.remote || false,
    file: environment.logging?.emitters?.file || false
  };
  remoteEndpoints = environment.logging?.remoteEndpoints || [];
  fileConfig = {
    ...environment.logging?.file,
    rotationPeriod: (environment.logging?.file?.rotationPeriod as 'hourly' | 'daily' | 'weekly') || 'daily'
  } as FileConfig;
  offlineConfig = environment.logging?.offline || { enabled: false };
  maxStoredLogs = environment.logging?.maxStoredLogs || 50;
  includeStacksInProduction = environment.logging?.includeStacksInProduction || false;
  
  // Export settings
  exportFormat = 'json';
  exportFilename = 'app-logs';
  exportLevel = 'all';
  
  // Offline log count
  offlineLogsCount = 0;
  
  // Computed properties
  get errorCount(): number {
    return this.logs.filter(log => 
      log.level === LogLevel.ERROR || log.level === LogLevel.FATAL
    ).length;
  }
  
  get hasOfflineLogs(): boolean {
    return this.offlineLogsCount > 0;
  }
  
  // Subscriptions
  private subscription = new Subscription();
  
  constructor(
    private loggingService: LoggingService,
    private debugConsoleService: DebugConsoleService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Only enable in non-production and only in browser environment
    if (!environment.production && isPlatformBrowser(this.platformId)) {
      // Load logs from localStorage
      this.logs = this.debugConsoleService.getStoredLogs();
      
      // Set up real-time log updates
      this.subscription.add(
        this.loggingService.getLogStream().subscribe(log => {
          this.addLogEntry(log);
        })
      );
      
      // Update clock
      this.updateClock();
      this.timeInterval = setInterval(() => this.updateClock(), 1000);
      
      // Check online status
      this.isOnline = navigator.onLine;
      
      window.addEventListener('online', () => {
        this.isOnline = true;
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
      
      // Check for offline logs count
      this.checkOfflineLogs();
      
      // Show by default in dev mode or if there are errors
      this.visible = !environment.production && 
        (this.logs.some(log => log.level === LogLevel.ERROR) || 
        this.logs.some(log => log.level === LogLevel.FATAL));
      
      this.applyFilters();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  toggleVisible(): void {
    this.visible = !this.visible;
  }

  toggleLevel(level: LogLevel): void {
    this.showLevel[level] = !this.showLevel[level];
    this.applyFilters();
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
    if (!isPlatformBrowser(this.platformId)) return;
    this.debugConsoleService.copyLogsToClipboard(this.logs, this.showLevel);
  }
  
  exportLogs(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loggingService.exportLogs();
    }
  }
  
  performExport(options: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Ensure options has the correct types
    const typedOptions: ExportOptions = {
      format: options.format as 'json' | 'compressed',
      filename: options.filename,
      level: options.level as 'all' | 'error' | 'info'
    };
    
    this.debugConsoleService.exportLogs(this.logs, typedOptions);
  }
  
  syncOfflineLogs(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.loggingService.syncOfflineLogs();
    this.offlineLogsCount = 0; // Reset count after sync
    
    this.loggingService.info('DebugConsole', 'Offline logs synchronized');
  }
  
  updateClock(): void {
    this.currentTime = new Date().toLocaleTimeString();
  }
  
  checkOfflineLogs(): void {
    // In a real implementation, this would check IndexedDB or localStorage
    // For this example, we'll simulate a random number of offline logs
    if (this.offlineConfig.enabled) {
      this.offlineLogsCount = Math.floor(Math.random() * 5);
    }
  }
  
  addLogEntry(log: LogEntry): void {
    // Add UI-specific properties
    const enhancedLog: EnhancedLogEntry = {
      ...log,
      expanded: false,
      activeTab: 'formatted'
    };
    
    // Add to beginning for most recent first
    this.logs.unshift(enhancedLog);
    
    // Enforce maximum log count
    if (this.logs.length > this.maxStoredLogs) {
      this.logs = this.logs.slice(0, this.maxStoredLogs);
    }
    
    // Update filtered logs
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredLogs = this.debugConsoleService.filterLogs(
      this.logs,
      this.showLevel,
      this.sourceFilter
    );
  }
}