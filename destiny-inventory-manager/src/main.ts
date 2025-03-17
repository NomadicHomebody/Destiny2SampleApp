import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Standalone component bootstrapping approach
bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error('Error bootstrapping app:', err));