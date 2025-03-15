import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <div class="login-container">
      <h2>Login to Destiny 2 Inventory Manager</h2>
      <button (click)="login()">Login with Bungie</button>
    </div>
  `,
  styles: [`
    .login-container {
      text-align: center;
      margin-top: 100px;
    }
    button {
      background-color: #7b68ee;
      color: white;
      padding: 12px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
  `]
})
export class LoginComponent {
  constructor(private authService: AuthService) {}
  
  login(): void {
    this.authService.login();
  }
}
