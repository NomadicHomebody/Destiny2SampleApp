import { Component, Input } from '@angular/core';
import { DestinyItem } from '../../models/vault.models';
import { Router } from '@angular/router';

@Component({
  selector: 'app-item-grid',
  templateUrl: './item-grid.component.html',
  styleUrls: ['./item-grid.component.scss']
})
export class ItemGridComponent {
  @Input() items: DestinyItem[] | null = [];

  constructor(private router: Router) {}

  viewItemDetails(item: DestinyItem): void {
    this.router.navigate(['/vault/item', item.itemInstanceId]);
  }
}
