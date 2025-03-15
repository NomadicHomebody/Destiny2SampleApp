// src/app/core/components/debug-console/components/log-entry-detail/log-entry-detail.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnhancedLogEntry } from '../../models/debug-console.models';

@Component({
  selector: 'app-log-entry-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
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
  `,
  styleUrls: ['./log-entry-detail.component.css']
})
export class LogEntryDetailComponent {
  @Input() log!: EnhancedLogEntry;
  
  formatFullTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid time';
    }
  }
  
  formatObject(obj: any): string {
    if (!obj) return 'None';
    
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  }
  
  formatLogEntry(log: EnhancedLogEntry): string {
    // Create a copy without UI-specific properties
    const cleanLog = { ...log };
    delete (cleanLog as any).expanded;
    delete (cleanLog as any).activeTab;
    
    return JSON.stringify(cleanLog, null, 2);
  }
}