import { NgModule, ErrorHandler } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

// Import our error handling components
import { GlobalErrorHandler } from './core/error-handling/global-error-handler';
import { HttpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { ApiKeyInterceptor } from './core/interceptors/api-key.interceptor';

@NgModule({
  declarations: [],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    AppComponent
  ],
  providers: [
    // Global error handler
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    // HTTP interceptors (order matters!)
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpErrorInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiKeyInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }