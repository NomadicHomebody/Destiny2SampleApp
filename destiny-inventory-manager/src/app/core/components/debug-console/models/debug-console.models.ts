// src/app/core/components/debug-console/models/debug-console.models.ts
import { LogEntry, LogLevel } from '../../../services/logging.service';

export interface EnhancedLogEntry extends LogEntry {
  expanded: boolean;
  activeTab: string;
}

export interface FileConfig {
  enabled: boolean;
  basePath?: string;
  folderNamePrefix?: string;
  maxSize?: number;
  maxFiles?: number;
  compress?: boolean;
  rotationPeriod?: 'hourly' | 'daily' | 'weekly' | string; // Add string to support any value
  filenamePattern?: string;
}

export interface OfflineConfig {
  enabled: boolean;
  maxBufferSize?: number;
  syncWhenOnline?: boolean;
}

export interface EmitterConfig {
  console: boolean;
  remote: boolean;
  file: boolean;
}

export interface ExportOptions {
    format: 'json' | 'compressed' | string; // Add string type to be more flexible
    filename: string;
    level: 'all' | 'error' | 'info' | string; // Also make this more flexible
}