import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [
    RouterOutlet
    // HttpClientModule is already provided at the module level - no need to import it here
  ]
})
export class AppComponent {
  title = 'destiny-inventory-manager';
}