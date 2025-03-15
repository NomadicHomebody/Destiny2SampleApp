import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VaultService } from '../../services/vault.service';
import { DestinyItem } from '../../models/vault.models';

@Component({
    selector: 'app-item-detail',
    templateUrl: './item-detail.component.html',
    styleUrls: ['./item-detail.component.css'] // Changed from .scss
  })
export class ItemDetailComponent implements OnInit {
  item: DestinyItem | null = null;
  loading = true;
  error = false;

  constructor(
    private route: ActivatedRoute,
    private vaultService: VaultService
  ) {}

  ngOnInit(): void {
    const itemId = this.route.snapshot.paramMap.get('id');
    if (itemId) {
      this.vaultService.vaultItems$.subscribe(items => {
        this.item = items.find(i => i.itemInstanceId === itemId) || null;
        this.loading = false;
        if (!this.item) {
          this.error = true;
        }
      });
    } else {
      this.loading = false;
      this.error = true;
    }
  }
}
