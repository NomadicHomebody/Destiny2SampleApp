import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnhancedLogEntry } from '../../models/debug-console.models';

@Component({
  selector: 'app-log-entry-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './log-entry-detail.component.html',
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