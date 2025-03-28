import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ElementRef, AfterViewInit, Renderer2, HostListener } from '@angular/core';
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

// Session storage key for tracking debug console sessions
const SESSION_ID_KEY = 'debug_console_session_id';
const AUTO_CLEAR_ENABLED_KEY = 'debug_console_auto_clear';

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
export class DebugConsoleComponent implements OnInit, OnDestroy, AfterViewInit {
  // Store a reference to LogLevel enum for template usage
  logLevels = LogLevel;
  objectKeys = Object.keys;
  
  isMaximized = false;

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
  
  // UI state - Set initial visibility to false
  visible = false;
  activeTab = 'logs';
  currentTime = '';
  timeInterval: any;
  isOnline = true;
  
  // Auto-clear settings
  autoClearEnabled = true;
  sessionId: string = '';
  
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
    @Inject(PLATFORM_ID) private platformId: Object,
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    // Only enable in non-production and only in browser environment
    if (!environment.production && isPlatformBrowser(this.platformId)) {
      // Initialize session tracking
      this.initializeSession();

      console.log('Debug console initialized, subscribing to log stream');

      // Set up real-time log updates
      this.subscription.add(
        this.loggingService.getLogStream().subscribe(log => {
          console.log('Log received in debug console:', log);
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
      
      // Show only if there are errors, not by default
      this.visible = (this.logs.some(log => log.level === LogLevel.ERROR) || 
                     this.logs.some(log => log.level === LogLevel.FATAL));
      
      this.applyFilters();
    }
    console.log('Debug console initializing...'); 
    
    // Removed the setTimeout that forced visibility to true
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Set up resize handles
      this.setupResizeHandles();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  /**
   * Handle browser window unload event to clear logs when user leaves the page
   */
  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    // Clear logs when leaving the page if auto-clear is enabled
    if (this.autoClearEnabled && isPlatformBrowser(this.platformId)) {
      this.loggingService.debug('DebugConsole', 'Session ending, auto-clearing logs');
      this.clearLogsInStorage();
    }
  }

  /**
   * Initialize session tracking for debug console
   */
  private initializeSession(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Load auto-clear setting
    const storedAutoClearSetting = localStorage.getItem(AUTO_CLEAR_ENABLED_KEY);
    if (storedAutoClearSetting !== null) {
      this.autoClearEnabled = storedAutoClearSetting === 'true';
    }

    // Generate a new unique session ID
    this.sessionId = this.generateSessionId();
    
    // Check if we have a different previous session
    const previousSessionId = sessionStorage.getItem(SESSION_ID_KEY);
    
    if (previousSessionId && previousSessionId !== this.sessionId) {
      // We have a new session, clear logs if auto-clear is enabled
      if (this.autoClearEnabled) {
        this.loggingService.debug('DebugConsole', 'New session detected, auto-clearing logs', {
          previousSession: previousSessionId,
          newSession: this.sessionId
        });
        this.clearLogsInStorage();
      }
    }
    
    // Store the current session ID
    sessionStorage.setItem(SESSION_ID_KEY, this.sessionId);
    
    // Load logs after session handling
    this.logs = this.debugConsoleService.getStoredLogs();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Toggle auto-clear setting
   */
  public toggleAutoClear(): void {
    this.autoClearEnabled = !this.autoClearEnabled;
    
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(AUTO_CLEAR_ENABLED_KEY, this.autoClearEnabled.toString());
      
      this.loggingService.info('DebugConsole', 'Auto-clear logs setting changed', {
        enabled: this.autoClearEnabled
      });
    }
  }

  /**
   * Setup resize handles for the debug console
   * This method is called in ngAfterViewInit and when the console becomes visible
   */
  private setupResizeHandles(): void {
    // Small delay to ensure DOM elements are fully rendered
    setTimeout(() => {
      const topLeftHandle = this.elementRef.nativeElement.querySelector('.resize-handle-top-left');
      const bottomLeftHandle = this.elementRef.nativeElement.querySelector('.resize-handle-bottom-left');
      
      if (topLeftHandle) {
        this.setupResizeHandler(topLeftHandle, 'topleft');
      } else {
        console.warn('Top-left resize handle not found in DOM');
      }
      
      if (bottomLeftHandle) {
        this.setupResizeHandler(bottomLeftHandle, 'bottomleft');
      } else {
        console.warn('Bottom-left resize handle not found in DOM');
      }
    }, 100);
  }

  /**
   * Setup an individual resize handler
   */
  private setupResizeHandler(handle: HTMLElement, type: 'topleft' | 'bottomleft'): void {
    // Remove any existing listeners to avoid duplicates
    const newHandle = handle.cloneNode(true);
    handle.parentNode?.replaceChild(newHandle, handle);
    
    // Use the standard Event interface and avoid explicit MouseEvent typing
    newHandle.addEventListener('mousedown', (e) => {
      // Cast e to MouseEvent safely
      const mouseEvent = e as MouseEvent;
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      
      // Get the console element
      const consoleElement = this.elementRef.nativeElement.querySelector('.debug-console');
      if (!consoleElement) {
        console.warn('Debug console element not found');
        return;
      }
      
      // Store initial state
      const startX = mouseEvent.clientX;
      const startY = mouseEvent.clientY;
      const startWidth = consoleElement.offsetWidth;
      const startHeight = consoleElement.offsetHeight;
      
      // Function to handle mouse movement
      const handleMouseMove = (moveEvent: Event) => {
        const mouseMoveEvent = moveEvent as MouseEvent;
        mouseMoveEvent.preventDefault(); // Prevent text selection during resize
        
        // Calculate how much the mouse has moved
        const deltaX = startX - mouseMoveEvent.clientX;
        const deltaY = type === 'topleft' ? 
                     startY - mouseMoveEvent.clientY : 
                     mouseMoveEvent.clientY - startY;
        
        // Update width based on horizontal movement
        let newWidth = startWidth + deltaX;
        
        // Enforce minimum width and maximum width
        newWidth = Math.max(400, Math.min(newWidth, window.innerWidth * 0.95));
        
        // Apply new width
        this.renderer.setStyle(consoleElement, 'width', `${newWidth}px`);
        
        // Update height based on vertical movement
        let newHeight;
        if (type === 'topleft') {
          newHeight = startHeight + (startY - mouseMoveEvent.clientY);
        } else { // bottomleft
          newHeight = startHeight + (mouseMoveEvent.clientY - startY);
        }
        
        // Enforce minimum height and maximum height
        newHeight = Math.max(300, Math.min(newHeight, window.innerHeight * 0.95));
        
        // Apply new height
        this.renderer.setStyle(consoleElement, 'height', `${newHeight}px`);
      };
      
      // Function to clean up event listeners
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      // Add event listeners for the drag operation
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
  }

  /**
   * Toggle the visibility of the debug console and setup resize handles when becoming visible
   */
  toggleVisible(): void {
    this.visible = !this.visible;
    
    // When becoming visible, ensure resize handlers are set up
    if (this.visible && isPlatformBrowser(this.platformId)) {
      // Use setTimeout to allow the DOM to update before attaching handlers
      setTimeout(() => this.setupResizeHandles(), 50);
    }
  }
  
  toggleLevel(level: LogLevel): void {
    this.showLevel[level] = !this.showLevel[level];
    this.applyFilters();
  }

  /**
   * Clear logs from memory and storage
   */
  clearLogs(): void {
    // Clear in-memory logs
    this.logs = [];
    this.applyFilters();
    
    this.clearLogsInStorage();
    
    this.loggingService.info('DebugConsole', 'Logs cleared by user');
  }

  /**
   * Clear logs in storage only
   */
  private clearLogsInStorage(): void {
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

  toggleMaximize(): void {
    this.isMaximized = !this.isMaximized;
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