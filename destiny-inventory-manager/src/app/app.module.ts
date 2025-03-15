import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    AppComponent
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }