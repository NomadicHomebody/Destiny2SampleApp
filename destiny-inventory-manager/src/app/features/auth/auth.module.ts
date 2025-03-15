import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Import the components
import { LoginComponent } from './components/login/login.component';
import { CallbackComponent } from './components/callback/callback.component';
import { ProfileComponent } from './components/profile/profile.component';
import { AUTH_ROUTES } from './auth.routes';
// AuthService is already provided in 'root', no need to provide it here

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forChild(AUTH_ROUTES),
    // Import standalone components instead of declaring them
    LoginComponent,
    CallbackComponent,
    ProfileComponent
  ],
  // Remove providers array since AuthService is already provided in 'root'
  exports: [
    RouterModule
  ]
})
export class AuthModule { }