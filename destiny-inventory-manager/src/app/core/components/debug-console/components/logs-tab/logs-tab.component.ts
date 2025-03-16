// src/app/core/components/debug-console/components/logs-tab/logs-tab.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogLevel } from '../../../../services/logging.service';
import { EnhancedLogEntry } from '../../models/debug-console.models';
import { LogEntryDetailComponent } from '../log-entry-detail/log-entry-detail.component';

@Component({
  selector: 'app-logs-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, LogEntryDetailComponent],
  template: `
    <ng-content></ng-content>
    
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
        <button *ngIf="sourceFilter" (click)="clearSourceFilter()" 
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
        
        <app-log-entry-detail *ngIf="log.expanded" [log]="log"></app-log-entry-detail>
      </div>
      
      <div *ngIf="filteredLogs.length === 0" class="no-logs">
        No logs to display
      </div>
    </div>
  `,
  styleUrls: ['./logs-tab.component.css']
})
export class LogsTabComponent {
  @Input() logs: EnhancedLogEntry[] = [];
  @Input() filteredLogs: EnhancedLogEntry[] = [];
  @Input() showLevel: Record<LogLevel, boolean> = {} as Record<LogLevel, boolean>;
  @Input() emitters: { console: boolean; remote: boolean; file: boolean; } = { console: true, remote: false, file: false };
  @Input() isOnline = true;
  
  @Output() filterChange = new EventEmitter<void>();
  @Output() levelToggle = new EventEmitter<LogLevel>();
  
  sourceFilter = '';
  logLevels = LogLevel;
  objectKeys = Object.keys;
  
  formatTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (e) {
      return 'Invalid time';
    }
  }
  
  toggleExpanded(log: EnhancedLogEntry): void {
    log.expanded = !log.expanded;
    if (log.expanded && !log.activeTab) {
      log.activeTab = 'formatted';
    }
  }
  
  toggleLevel(level: LogLevel): void {
    this.levelToggle.emit(level);
  }
  
  applyFilters(): void {
    this.filterChange.emit();
  }
  
  clearSourceFilter(): void {
    this.sourceFilter = '';
    this.applyFilters();
  }
  
  getLevelValue(level: string): LogLevel {
    return LogLevel[level as keyof typeof LogLevel];
  }
}