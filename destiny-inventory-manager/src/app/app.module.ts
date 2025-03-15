import { NgModule, PLATFORM_ID, inject } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { isPlatformBrowser } from '@angular/common';

// Optional: Create a safe initialization function that checks platform
function initializeApp() {
  return () => {
    const platformId = inject(PLATFORM_ID);
    if (isPlatformBrowser(platformId)) {
      // Safe to access browser APIs here
      console.log('Running in browser environment');
    } else {
      console.log('Running on the server');
    }
    return Promise.resolve();
  };
}

@NgModule({
  imports: [
    // Modern approach - don't use withServerTransition
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    AppComponent
  ],
  providers: [
    // Add this provider if you need initialization that deals with browser APIs
    // {
    //   provide: APP_INITIALIZER,
    //   useFactory: initializeApp,
    //   multi: true
    // }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
