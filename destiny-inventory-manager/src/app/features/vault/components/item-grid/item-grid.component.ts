import { Component, Input } from '@angular/core';
import { DestinyItem } from '../../models/vault.models';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-item-grid',
    templateUrl: './item-grid.component.html',
    styleUrls: ['./item-grid.component.css'],
    standalone: true,
    imports: [CommonModule]
  })
export class ItemGridComponent {
  @Input() items: DestinyItem[] | null = [];

  constructor(private router: Router) {}

  viewItemDetails(item: DestinyItem): void {
    this.router.navigate(['/vault/item', item.itemInstanceId]);
  }
}
