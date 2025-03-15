// src/app/core/components/debug-console/components/files-tab/files-tab.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileConfig, ExportOptions } from '../../models/debug-console.models';

@Component({
  selector: 'app-files-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
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
  `,
  styleUrls: ['./files-tab.component.css']
})
export class FilesTabComponent {
  @Input() fileConfig: FileConfig = { enabled: false };
  
  @Output() export = new EventEmitter<{format: string, filename: string, level: string}>();
  
  // Add these missing properties that are used in your template
  exportFormat: string = 'json';  // Add this property
  exportFilename: string = 'app-logs';  // Add this property
  exportLevel: string = 'all';  // Add this property
  
  performExport(): void {
    this.export.emit({
      format: this.exportFormat,
      filename: this.exportFilename,
      level: this.exportLevel
    });
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
}