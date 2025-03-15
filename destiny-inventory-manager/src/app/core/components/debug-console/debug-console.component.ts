import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoggingService, LogEntry, LogLevel } from '../../services/logging.service';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import * as pako from 'pako';

@Component({
  selector: 'app-debug-console',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="debug-console" *ngIf="visible">
      <div class="debug-header">
        <div class="title-area">
          <h3>Debug Console</h3>
          <span class="version-badge">v{{appVersion}}</span>
        </div>
        <div class="debug-actions">
          <button (click)="clearLogs()" class="action-btn clear-btn" title="Clear logs">
            <span class="icon">🗑️</span>
          </button>
          <button (click)="copyLogs()" class="action-btn copy-btn" title="Copy logs">
            <span class="icon">📋</span>
          </button>
          <button (click)="exportLogs()" class="action-btn export-btn" title="Export logs">
            <span class="icon">📤</span>
          </button>
          <button (click)="syncOfflineLogs()" [disabled]="!hasOfflineLogs" 
                  class="action-btn sync-btn" [ngClass]="{'disabled': !hasOfflineLogs}" 
                  title="Sync offline logs">
            <span class="icon">🔄</span>
          </button>
          <button (click)="toggleVisible()" class="action-btn close-btn" title="Close">
            <span class="icon">✖️</span>
          </button>
        </div>
      </div>
      
      <div class="tabs">
        <button [class.active]="activeTab === 'logs'" (click)="activeTab = 'logs'">Logs</button>
        <button [class.active]="activeTab === 'files'" (click)="activeTab = 'files'">Files</button>
        <button [class.active]="activeTab === 'settings'" (click)="activeTab = 'settings'">Settings</button>
      </div>
      
      <div class="tab-content">
        <!-- LOGS TAB -->
        <div *ngIf="activeTab === 'logs'">
          <div class="debug-filters">
            <div class="level-filters">
            <label *ngFor="let level of objectKeys(logLevels)">
                <input type="checkbox" [checked]="showLevel[getLevelValue(level)]" 
                    (change)="toggleLevel(getLevelValue(level))">
                <span [ngClass]="'level-text-' + level.toLowerCase()">{{level}}</span>
            </label>
            </div>
            
            <div class="source-filter">
              <input type="text" placeholder="Filter by source..." 
                    [(ngModel)]="sourceFilter" (input)="applyFilters()">
              <button *ngIf="sourceFilter" (click)="sourceFilter = ''; applyFilters()" 
                      class="clear-filter">✖</button>
            </div>
            
            <div class="emitter-status">
              <span class="emitter-badge" [class.active]="emitters.console" title="Console logging">🖥️</span>
              <span class="emitter-badge" [class.active]="emitters.remote" title="Remote logging">🌐</span>
              <span class="emitter-badge" [class.active]="emitters.file" title="File logging">📁</span>
              <span class="emitter-badge" [class.active]="isOnline" title="Online status">
                {{ isOnline ? '🔵' : '🔴' }}
              </span>
            </div>
          </div>
          
          <div class="debug-content">
            <div *ngFor="let log of filteredLogs" class="log-entry" [ngClass]="'level-' + log.level.toLowerCase()">
              <div class="log-header" (click)="toggleExpanded(log)">
                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                <span class="log-level" [ngClass]="'level-text-' + log.level.toLowerCase()">{{ log.level }}</span>
                <span class="log-source">{{ log.source }}</span>
                <span class="log-message">{{ log.message }}</span>
                <span class="expand-icon">{{ log.expanded ? '▼' : '►' }}</span>
              </div>
              <div class="log-details" *ngIf="log.expanded">
                <div class="details-tabs">
                  <button [class.active]="log.activeTab === 'formatted'" 
                          (click)="log.activeTab = 'formatted'">Formatted</button>
                  <button [class.active]="log.activeTab === 'raw'" 
                          (click)="log.activeTab = 'raw'">Raw JSON</button>
                  <button [class.active]="log.activeTab === 'context'" 
                          (click)="log.activeTab = 'context'">Context</button>
                  <button *ngIf="log.technical" [class.active]="log.activeTab === 'error'" 
                          (click)="log.activeTab = 'error'">Error</button>
                </div>
                
                <div [ngSwitch]="log.activeTab">
                  <div *ngSwitchCase="'formatted'" class="formatted-view">
                    <div class="detail-item">
                      <div class="detail-label">Message:</div>
                      <div class="detail-value">{{ log.message }}</div>
                    </div>
                    <div class="detail-item" *ngIf="log.code">
                      <div class="detail-label">Code:</div>
                      <div class="detail-value">{{ log.code }}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">Source:</div>
                      <div class="detail-value">{{ log.source }}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">Time:</div>
                      <div class="detail-value">{{ formatFullTime(log.timestamp) }}</div>
                    </div>
                    <div class="detail-item" *ngIf="log.context?.url">
                      <div class="detail-label">URL:</div>
                      <div class="detail-value">{{ log.context?.url }}</div>
                    </div>
                    <div class="detail-item" *ngIf="log.context?.user">
                      <div class="detail-label">User:</div>
                      <div class="detail-value">{{ formatObject(log.context?.user) }}</div>
                    </div>
                  </div>
                  
                  <pre *ngSwitchCase="'raw'">{{ formatLogEntry(log) }}</pre>
                  
                  <div *ngSwitchCase="'context'" class="context-view">
                    <div class="detail-item" *ngIf="log.context?.additionalData">
                      <div class="detail-label">Additional Data:</div>
                      <div class="detail-value">
                        <pre>{{ formatObject(log.context?.additionalData) }}</pre>
                      </div>
                    </div>
                    <div class="detail-item" *ngIf="log.metadata">
                      <div class="detail-label">Metadata:</div>
                      <div class="detail-value">
                        <pre>{{ formatObject(log.metadata) }}</pre>
                      </div>
                    </div>
                    <div class="detail-item" *ngIf="log.filters">
                      <div class="detail-label">Filters:</div>
                      <div class="detail-value">
                        <pre>{{ formatObject(log.filters) }}</pre>
                      </div>
                    </div>
                  </div>
                  
                  <div *ngSwitchCase="'error'" class="error-view">
                    <div class="detail-item">
                      <div class="detail-label">Error Name:</div>
                      <div class="detail-value">{{ log.technical?.name }}</div>
                    </div>
                    <div class="detail-item" *ngIf="log.technical?.stack">
                      <div class="detail-label">Stack Trace:</div>
                      <div class="detail-value">
                        <pre class="stack-trace">{{ log.technical?.stack }}</pre>
                      </div>
                    </div>
                    <div class="detail-item" *ngIf="log.technical?.rawError">
                      <div class="detail-label">Error Details:</div>
                      <div class="detail-value">
                        <pre>{{ formatObject(log.technical?.rawError) }}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div *ngIf="filteredLogs.length === 0" class="no-logs">
              No logs to display
            </div>
          </div>
        </div>
        
        <!-- FILES TAB -->
        <div *ngIf="activeTab === 'files'">
          <div class="files-info">
            <div class="file-config-section">
              <h4>File Logging Configuration</h4>
              <div class="file-config-item">
                <span class="config-label">Base Path:</span>
                <span class="config-value">{{ fileConfig.basePath || 'Not configured' }}</span>
              </div>
              <div class="file-config-item">
                <span class="config-label">Folder Prefix:</span>
                <span class="config-value">{{ fileConfig.folderNamePrefix || 'None' }}</span>
              </div>
              <div class="file-config-item">
                <span class="config-label">Compression:</span>
                <span class="config-value">{{ fileConfig.compress ? 'Enabled' : 'Disabled' }}</span>
              </div>
              <div class="file-config-item">
                <span class="config-label">Rotation:</span>
                <span class="config-value">{{ fileConfig.rotationPeriod || 'None' }}</span>
              </div>
              <div class="file-config-item">
                <span class="config-label">Max Size:</span>
                <span class="config-value">{{ formatFileSize(fileConfig.maxSize) }}</span>
              </div>
            </div>
            
            <div class="file-actions">
              <h4>Log Export Options</h4>
              <div class="file-type-selection">
                <label>
                  <input type="radio" name="fileType" [(ngModel)]="exportFormat" value="json">
                  JSON
                </label>
                <label>
                  <input type="radio" name="fileType" [(ngModel)]="exportFormat" value="compressed">
                  Compressed (gzip)
                </label>
              </div>
              
              <div class="file-export-options">
                <div class="option-row">
                  <label>Filename:</label>
                  <input type="text" [(ngModel)]="exportFilename" placeholder="app-logs">
                </div>
                
                <div class="option-row">
                  <label>Level Filter:</label>
                  <select [(ngModel)]="exportLevel">
                    <option value="all">All Levels</option>
                    <option value="error">Errors Only</option>
                    <option value="info">Info & Above</option>
                  </select>
                </div>
                
                <button (click)="performExport()" class="export-button">
                  Export Logs
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- SETTINGS TAB -->
        <div *ngIf="activeTab === 'settings'">
          <div class="settings-info">
            <h4>Logging Configuration</h4>
            
            <div class="settings-section">
              <div class="setting-item">
                <span class="setting-label">Minimum Level:</span>
                <span class="setting-value level-text-{{minLogLevel.toLowerCase()}}">{{ minLogLevel }}</span>
              </div>
              
              <div class="setting-item">
                <span class="setting-label">Emitters:</span>
                <div class="setting-value emitters-list">
                  <span class="emitter-item" [class.enabled]="emitters.console">
                    Console {{ emitters.console ? '✓' : '✗' }}
                  </span>
                  <span class="emitter-item" [class.enabled]="emitters.remote">
                    Remote {{ emitters.remote ? '✓' : '✗' }}
                  </span>
                  <span class="emitter-item" [class.enabled]="emitters.file">
                    File {{ emitters.file ? '✓' : '✗' }}
                  </span>
                </div>
              </div>
              
              <div class="setting-item" *ngIf="emitters.remote">
                <span class="setting-label">Remote Endpoints:</span>
                <div class="setting-value">
                  <ul class="endpoints-list">
                    <li *ngFor="let endpoint of remoteEndpoints">{{ endpoint }}</li>
                    <li *ngIf="remoteEndpoints.length === 0">No endpoints configured</li>
                  </ul>
                </div>
              </div>
              
              <div class="setting-item">
                <span class="setting-label">Max Stored Logs:</span>
                <span class="setting-value">{{ maxStoredLogs }}</span>
              </div>
              
              <div class="setting-item">
                <span class="setting-label">Include Stack Traces:</span>
                <span class="setting-value">{{ includeStacksInProduction ? 'Yes' : 'Only in development' }}</span>
              </div>
            </div>
            
            <h4>Offline Logging</h4>
            <div class="settings-section">
              <div class="setting-item">
                <span class="setting-label">Offline Support:</span>
                <span class="setting-value">{{ offlineConfig.enabled ? 'Enabled' : 'Disabled' }}</span>
              </div>
              
              <div class="setting-item" *ngIf="offlineConfig.enabled">
                <span class="setting-label">Offline Logs:</span>
                <span class="setting-value">{{ offlineLogsCount || 0 }} pending logs</span>
              </div>
              
              <div class="setting-item" *ngIf="offlineConfig.enabled">
                <span class="setting-label">Auto Sync:</span>
                <span class="setting-value">{{ offlineConfig.syncWhenOnline ? 'Enabled' : 'Manual' }}</span>
              </div>
              
              <div class="setting-actions" *ngIf="offlineConfig.enabled && offlineLogsCount > 0">
                <button (click)="syncOfflineLogs()" class="sync-button">
                  Sync Offline Logs Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="console-footer">
        <div class="log-count">
          <span class="count-label">Logs:</span>
          <span class="count-value">{{ logs.length }}</span>
          <span class="filtered-label" *ngIf="logs.length !== filteredLogs.length">
            ({{ filteredLogs.length }} filtered)
          </span>
        </div>
        
        <div class="status-info">
          {{ isOnline ? 'Online' : 'Offline' }} | 
          {{ currentTime }}
        </div>
      </div>
    </div>
    
    <div class="debug-trigger" (click)="toggleVisible()" *ngIf="!visible">
      <span>Debug</span>
      <span class="log-count" *ngIf="errorCount">{{ errorCount }}</span>
      <span class="offline-indicator" *ngIf="!isOnline">🔴</span>
    </div>
  `,
  styles: [`
    /* Main container styles */
    .debug-console {
      position: fixed;
      bottom: 0;
      right: 0;
      width: 90%;
      max-width: 900px;
      height: 70%;
      background-color: rgba(20, 20, 20, 0.97);
      color: #f5f5f5;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      border-top-left-radius: 6px;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.5);
      font-family: monospace;
      transition: all 0.3s ease;
    }
    
    /* Header styles */
    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      background-color: #272727;
      border-top-left-radius: 6px;
      border-bottom: 1px solid #444;
    }
    
    .title-area {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .debug-header h3 {
      margin: 0;
      font-size: 1rem;
      color: #e67e22;
    }
    
    .version-badge {
      background-color: #444;
      font-size: 0.7rem;
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
      color: #aaa;
    }
    
    .debug-actions {
      display: flex;
      gap: 0.5rem;
    }
    
    .action-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #333;
      border: none;
      border-radius: 3px;
      color: #fff;
      cursor: pointer;
      font-size: 0.8rem;
      padding: 0;
      transition: background-color 0.2s;
    }
    
    .action-btn:hover {
      background-color: #444;
    }
    
    .clear-btn:hover {
      background-color: #c0392b;
    }
    
    .copy-btn:hover {
      background-color: #3498db;
    }
    
    .export-btn:hover {
      background-color: #2ecc71;
    }
    
    .sync-btn:hover {
      background-color: #f39c12;
    }
    
    .sync-btn.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .close-btn:hover {
      background-color: #c0392b;
    }
    
    .icon {
      font-size: 14px;
    }
    
    /* Tabs styles */
    .tabs {
      display: flex;
      background-color: #222;
      border-bottom: 1px solid #444;
    }
    
    .tabs button {
      padding: 0.5rem 1rem;
      background-color: transparent;
      border: none;
      color: #aaa;
      cursor: pointer;
      font-size: 0.9rem;
      position: relative;
      transition: color 0.2s;
    }
    
    .tabs button:hover {
      color: #fff;
    }
    
    .tabs button.active {
      color: #e67e22;
    }
    
    .tabs button.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background-color: #e67e22;
    }
    
    /* Tab content */
    .tab-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    /* Logs tab */
    .debug-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background-color: #1a1a1a;
      border-bottom: 1px solid #333;
      align-items: center;
    }
    
    .level-filters {
      display: flex;
      gap: 0.75rem;
    }
    
    .level-filters label {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8rem;
      cursor: pointer;
    }
    
    .source-filter {
      position: relative;
      margin-left: auto;
    }
    
    .source-filter input {
      padding: 0.3rem 0.5rem;
      padding-right: 1.5rem;
      background-color: #333;
      border: 1px solid #444;
      border-radius: 3px;
      color: #fff;
      font-size: 0.8rem;
      width: 150px;
    }
    
    .clear-filter {
      position: absolute;
      right: 5px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      font-size: 0.7rem;
      padding: 0;
    }
    
    .emitter-status {
      display: flex;
      gap: 0.5rem;
      margin-left: 1rem;
    }
    
    .emitter-badge {
      font-size: 1rem;
      opacity: 0.3;
    }
    
    .emitter-badge.active {
      opacity: 1;
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
      background-color: #1a1a1a;
    }
    
    .log-header {
      display: flex;
      padding: 0.5rem;
      cursor: pointer;
      font-size: 0.9rem;
      align-items: center;
    }
    
    .log-header:hover {
      background-color: rgba(255, 255, 255, 0.05);
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
    
    .level-text-debug { color: #7f8c8d; }
    .level-text-info { color: #3498db; }
    .level-text-warn { color: #f39c12; }
    .level-text-error { color: #e74c3c; }
    .level-text-fatal { color: #c0392b; }
    
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
      padding: 0;
      background-color: #222;
      border-top: 1px solid #333;
      font-size: 0.8rem;
    }
    
    .details-tabs {
      display: flex;
      background-color: #1a1a1a;
      border-bottom: 1px solid #333;
    }
    
    .details-tabs button {
      padding: 0.3rem 0.6rem;
      background-color: transparent;
      border: none;
      color: #aaa;
      font-size: 0.7rem;
      cursor: pointer;
    }
    
    .details-tabs button.active {
      color: #e67e22;
      background-color: #252525;
    }
    
    .details-tabs button:hover {
      color: #fff;
    }
    
    .formatted-view, .context-view, .error-view {
      padding: 0.5rem;
    }
    
    .detail-item {
      margin-bottom: 0.5rem;
    }
    
    .detail-label {
      color: #aaa;
      font-size: 0.75rem;
      margin-bottom: 0.2rem;
    }
    
    .detail-value {
      color: #fff;
    }
    
    .log-details pre {
      margin: 0;
      padding: 0.5rem;
      white-space: pre-wrap;
      overflow-x: auto;
      font-size: 0.75rem;
      background-color: #1a1a1a;
      border-radius: 3px;
    }
    
    .stack-trace {
      white-space: pre-wrap;
      color: #e74c3c;
    }
    
    .no-logs {
      text-align: center;
      padding: 1rem;
      color: #aaa;
      font-style: italic;
    }
    
    /* Files tab */
    .files-info {
      padding: 1rem;
      display: flex;
      gap: 2rem;
      overflow-y: auto;
      height: 100%;
    }
    
    .file-config-section, .file-actions {
      flex: 1;
    }
    
    .files-info h4 {
      margin-top: 0;
      color: #e67e22;
      font-size: 1rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #333;
      padding-bottom: 0.5rem;
    }
    
    .file-config-item {
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
    }
    
    .config-label {
      width: 120px;
      color: #aaa;
      font-size: 0.85rem;
    }
    
    .config-value {
      color: #fff;
      font-size: 0.85rem;
    }
    
    .file-type-selection {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .file-type-selection label {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      cursor: pointer;
    }
    
    .file-export-options {
      background-color: #1a1a1a;
      padding: 1rem;
      border-radius: 4px;
      border: 1px solid #333;
    }
    
    .option-row {
      display: flex;
      margin-bottom: 0.75rem;
      align-items: center;
    }
    
    .option-row label {
      width: 100px;
      font-size: 0.85rem;
      color: #aaa;
    }
    
    .option-row input, .option-row select {
      flex: 1;
      padding: 0.3rem 0.5rem;
      background-color: #333;
      border: 1px solid #444;
      border-radius: 3px;
      color: #fff;
      font-size: 0.8rem;
    }
    
    .export-button {
      width: 100%;
      padding: 0.5rem;
      margin-top: 0.5rem;
      background-color: #2ecc71;
      border: none;
      border-radius: 3px;
      color: #fff;
      font-weight: bold;
      cursor: pointer;
    }
    
    .export-button:hover {
      background-color: #27ae60;
    }
    
    /* Settings tab */
    .settings-info {
      padding: 1rem;
      overflow-y: auto;
      height: 100%;
    }
    
    .settings-info h4 {
      margin-top: 0;
      color: #e67e22;
      font-size: 1rem;
      margin-bottom: 0.75rem;
    }
    
    .settings-section {
      background-color: #1a1a1a;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1.5rem;
    }
    
    .setting-item {
      display: flex;
      margin-bottom: 0.75rem;
    }
    
    .setting-label {
      width: 150px;
      color: #aaa;
      font-size: 0.85rem;
    }
    
    .setting-value {
      flex: 1;
      color: #fff;
      font-size: 0.85rem;
    }
    
    .emitters-list {
      display: flex;
      gap: 1rem;
    }
    
    .emitter-item {
      padding: 0.2rem 0.5rem;
      background-color: #333;
      border-radius: 3px;
      font-size: 0.75rem;
      color: #aaa;
    }
    
    .emitter-item.enabled {
      color: #fff;
      background-color: #2c3e50;
    }
    
    .endpoints-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    
    .endpoints-list li {
      padding: 0.3rem 0;
      border-bottom: 1px solid #333;
      font-size: 0.75rem;
    }
    
    .endpoints-list li:last-child {
      border-bottom: none;
    }
    
    .sync-button {
      padding: 0.5rem 1rem;
      background-color: #f39c12;
      border: none;
      border-radius: 3px;
      color: #fff;
      font-weight: bold;
      cursor: pointer;
      margin-top: 0.5rem;
    }
    
    .sync-button:hover {
      background-color: #e67e22;
    }
    
    /* Footer */
    .console-footer {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 1rem;
      background-color: #272727;
      border-top: 1px solid #444;
      font-size: 0.8rem;
    }
    
    .log-count {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    
    .count-label, .filtered-label {
      color: #aaa;
    }
    
    .count-value {
      color: #fff;
    }
    
    .status-info {
      color: #aaa;
    }
    
    /* Debug trigger button */
    .debug-trigger {
      position: fixed;
      bottom: 15px;
      right: 15px;
      padding: 0.4rem 0.8rem;
      background-color: rgba(20, 20, 20, 0.8);
      color: #f5f5f5;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
      border: 1px solid #333;
    }
    
    .debug-trigger:hover {
      background-color: rgba(20, 20, 20, 0.95);
    }
    
    .debug-trigger .log-count {
      background-color: #e74c3c;
      color: #fff;
      font-size: 0.7rem;
      height: 18px;
      min-width: 18px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }
    
    .offline-indicator {
      font-size: 0.7rem;
    }
    
    /* Level background colors */
    .level-debug {
      border-left: 3px solid #7f8c8d;
    }
    
    .level-info {
      border-left: 3px solid #3498db;
    }
    
    .level-warn {
      border-left: 3px solid #f39c12;
    }
    
    .level-error {
      border-left: 3px solid #e74c3c;
    }
    
    .level-fatal {
      border-left: 3px solid #c0392b;
      background-color: rgba(192, 57, 43, 0.1);
    }
  `]
})
export class DebugConsoleComponent implements OnInit, OnDestroy {
  // Store a reference to LogLevel enum for template usage
  logLevels = LogLevel;
  objectKeys = Object.keys;
  
  // Logs storage
  logs: Array<LogEntry & { expanded: boolean; activeTab: string }> = [];
  filteredLogs: Array<LogEntry & { expanded: boolean; activeTab: string }> = [];
  
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
  fileConfig = environment.logging?.file || { enabled: false };
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

  getLevelValue(level: string): LogLevel {
    // Safety check since LogLevel is an enum
    return LogLevel[level as keyof typeof LogLevel];
  }
  
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
      
      // Check for offline logs count - simulated for this example
      // In a real implementation, this would query IndexedDB or localStorage
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

  toggleExpanded(log: LogEntry & { expanded: boolean; activeTab: string }): void {
    log.expanded = !log.expanded;
    if (log.expanded && !log.activeTab) {
      log.activeTab = 'formatted';
    }
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
        // For visual feedback
        this.loggingService.info('DebugConsole', 'Logs copied to clipboard');
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
  
  performExport(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Filter logs by level if needed
    let logsToExport = [...this.logs];
    
    if (this.exportLevel === 'error') {
      logsToExport = logsToExport.filter(log => 
        log.level === LogLevel.ERROR || log.level === LogLevel.FATAL
      );
    } else if (this.exportLevel === 'info') {
      logsToExport = logsToExport.filter(log => 
        log.level !== LogLevel.DEBUG
      );
    }
    
    // Format the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${this.exportFilename}-${timestamp}`;
    
    // Export the logs
    try {
      if (this.exportFormat === 'compressed') {
        // Use pako for compression if available
        if (typeof pako !== 'undefined') {
          const logText = JSON.stringify(logsToExport);
          const compressed = pako.gzip(logText);
          const blob = new Blob([compressed], { type: 'application/gzip' });
          this.triggerDownload(blob, filename + '.gz');
        } else {
          // Fallback if pako is not available
          const blob = new Blob([JSON.stringify(logsToExport, null, 2)], { type: 'application/json' });
          this.triggerDownload(blob, filename + '.json');
        }
      } else {
        // Standard JSON export
        const blob = new Blob([JSON.stringify(logsToExport, null, 2)], { type: 'application/json' });
        this.triggerDownload(blob, filename + '.json');
      }
      
      this.loggingService.info('DebugConsole', 'Logs exported', { 
        filename, 
        format: this.exportFormat, 
        count: logsToExport.length 
      });
    } catch (e) {
      console.error('Failed to export logs:', e);
    }
  }
  
  syncOfflineLogs(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.loggingService.syncOfflineLogs();
    this.offlineLogsCount = 0; // Simulate successful sync
    
    this.loggingService.info('DebugConsole', 'Offline logs synchronized');
  }

  formatTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (e) {
      return 'Invalid time';
    }
  }
  
  formatFullTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid time';
    }
  }

  formatLogEntry(log: LogEntry): string {
    // Create a copy without UI-specific properties
    const cleanLog = { ...log };
    delete (cleanLog as any).expanded;
    delete (cleanLog as any).activeTab;
    
    return JSON.stringify(cleanLog, null, 2);
  }
  
  formatObject(obj: any): string {
    if (!obj) return 'None';
    
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  }
  
  formatFileSize(bytes?: number): string {
    if (bytes === undefined) return 'Unknown';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
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
    const enhancedLog = {
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

  private loadSavedLogs(): void {
    // Only try to access localStorage in browser environment
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      // Use the loggingService to get stored logs
      const storedLogs = this.loggingService.getStoredLogs();
      this.logs = storedLogs.map((log: LogEntry) => ({
        ...log,
        expanded: false,
        activeTab: 'formatted'
      }));
    } catch (e) {
      console.error('Failed to load saved logs:', e);
    }
  }

  public applyFilters(): void {
    this.filteredLogs = this.logs.filter(log => {
      // Filter by level
      if (!this.showLevel[log.level]) {
        return false;
      }
      
      // Filter by source if a source filter is applied
      if (this.sourceFilter && !log.source.toLowerCase().includes(this.sourceFilter.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }
  
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  }
}