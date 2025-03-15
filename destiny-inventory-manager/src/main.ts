import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

// Since you have an AppModule set up, use NgModule-based bootstrap
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error('Error bootstrapping app:', err));