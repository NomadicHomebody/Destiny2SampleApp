// src/app/core/components/debug-console/components/settings-tab/settings-tab.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmitterConfig, OfflineConfig } from '../../models/debug-console.models';

@Component({
  selector: 'app-settings-tab',
  standalone: true,
  imports: [CommonModule],
  template: `
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
          <button (click)="onSyncOfflineLogs()" class="sync-button">
            Sync Offline Logs Now
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./settings-tab.component.css']
})
export class SettingsTabComponent {
  @Input() minLogLevel: string = 'DEBUG';
  @Input() emitters: EmitterConfig = { console: true, remote: false, file: false };
  @Input() remoteEndpoints: string[] = [];
  @Input() maxStoredLogs: number = 50;
  @Input() includeStacksInProduction: boolean = false;
  @Input() offlineConfig: OfflineConfig = { enabled: false };
  @Input() offlineLogsCount: number = 0;
  
  @Output() syncOfflineLogs = new EventEmitter<void>();
  
  onSyncOfflineLogs(): void {
    this.syncOfflineLogs.emit();
  }
}