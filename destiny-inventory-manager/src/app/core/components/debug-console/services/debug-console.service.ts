import { Injectable } from '@angular/core';
import { LoggingService, LogEntry, LogLevel } from '../../../services/logging.service';
import { EnhancedLogEntry, ExportOptions } from '../models/debug-console.models';
import * as pako from 'pako';

@Injectable({
  providedIn: 'root'
})
export class DebugConsoleService {
  constructor(private loggingService: LoggingService) {}
  
  getStoredLogs(): EnhancedLogEntry[] {
    try {
      const storedLogs = this.loggingService.getStoredLogs();
      return storedLogs.map((log: LogEntry) => ({
        ...log,
        expanded: false,
        activeTab: 'formatted'
      }));
    } catch (e) {
      console.error('Failed to load saved logs:', e);
      return [];
    }
  }
  
  filterLogs(logs: EnhancedLogEntry[], showLevel: Record<LogLevel, boolean>, sourceFilter: string): EnhancedLogEntry[] {
    return logs.filter(log => {
      // Filter by level
      if (!showLevel[log.level]) {
        return false;
      }
      
      // Filter by source if a source filter is applied
      if (sourceFilter && !log.source.toLowerCase().includes(sourceFilter.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }
  
  exportLogs(logs: EnhancedLogEntry[], options: ExportOptions): void {
    // Filter logs by level if needed
    let logsToExport = [...logs];
    
    if (options.level === 'error') {
      logsToExport = logsToExport.filter(log => 
        log.level === LogLevel.ERROR || log.level === LogLevel.FATAL
      );
    } else if (options.level === 'info') {
      logsToExport = logsToExport.filter(log => 
        log.level !== LogLevel.DEBUG
      );
    }
    
    // Format the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${options.filename}-${timestamp}`;
    
    // Export the logs
    try {
      if (options.format === 'compressed') {
        // Use pako for compression
        const logText = JSON.stringify(logsToExport);
        const compressed = pako.gzip(logText);
        const blob = new Blob([compressed], { type: 'application/gzip' });
        this.triggerDownload(blob, filename + '.gz');
      } else {
        // Standard JSON export
        const blob = new Blob([JSON.stringify(logsToExport, null, 2)], { type: 'application/json' });
        this.triggerDownload(blob, filename + '.json');
      }
      
      this.loggingService.info('DebugConsole', 'Logs exported', { 
        filename, 
        format: options.format, 
        count: logsToExport.length 
      });
    } catch (e) {
      console.error('Failed to export logs:', e);
    }
  }
  
  triggerDownload(blob: Blob, filename: string): void {
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
  
  copyLogsToClipboard(logs: EnhancedLogEntry[], showLevel: Record<LogLevel, boolean>): void {
    const logText = logs
      .filter(log => showLevel[log.level])
      .map(log => JSON.stringify(log, null, 2))
      .join('\n\n');
    
    navigator.clipboard.writeText(logText)
      .then(() => {
        console.log('Logs copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy logs: ', err);
      });
  }
}