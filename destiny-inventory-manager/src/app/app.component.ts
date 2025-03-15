import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../environments/environment';
import { LoggingService } from './core/services/logging.service';
import { DebugConsoleComponent } from './core/components/debug-console/debug-console.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    DebugConsoleComponent
  ]
})
export class AppComponent implements OnInit {
  title = 'destiny-inventory-manager';
  // Compute this once rather than use environment directly in template
  showDebugConsole = !environment.production;
  
  constructor(private loggingService: LoggingService) {}
  
  ngOnInit() {
    // Log application startup
    this.loggingService.info('AppComponent', 'Application initialized', {
      version: environment.logging.appVersion,
      environment: environment.production ? 'production' : 'development'
    });
    
    // Set up window error handler for additional error catching
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.loggingService.error(
          'WindowError',
          event.message || 'Unhandled window error',
          event.error,
          'WINDOW_ERROR',
          {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        );
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        this.loggingService.error(
          'UnhandledPromiseRejection',
          'Unhandled Promise rejection',
          event.reason,
          'PROMISE_REJECTION'
        );
      });
    }
  }
}