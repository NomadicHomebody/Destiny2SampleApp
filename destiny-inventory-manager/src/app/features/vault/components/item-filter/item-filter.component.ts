import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { VaultFilter } from '../../models/vault.models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-item-filter',
  templateUrl: './item-filter.component.html',
  styleUrls: ['./item-filter.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class ItemFilterComponent implements OnInit {
  @Output() filterChange = new EventEmitter<VaultFilter>();
  
  filterForm: FormGroup;
  showAdvancedFilters = false;
  
  itemTypes = [
    { id: null, name: 'All Types' },
    { id: 1, name: 'Weapon' },
    { id: 2, name: 'Armor' },
    { id: 3, name: 'Ghost' },
    { id: 4, name: 'Vehicle' },
    { id: 5, name: 'Emblem' },
    { id: 6, name: 'Ship' },
    { id: 7, name: 'Consumable' },
    { id: 8, name: 'Material' }
  ];
  
  tierTypes = [
    { id: null, name: 'All Rarities' },
    { id: 1, name: 'Common' },
    { id: 2, name: 'Uncommon' },
    { id: 3, name: 'Rare' },
    { id: 4, name: 'Legendary' },
    { id: 5, name: 'Exotic' }
  ];
  
  damageTypes = [
    { id: null, name: 'All Elements' },
    { id: 0, name: 'None' },
    { id: 1, name: 'Kinetic' },
    { id: 2, name: 'Arc' },
    { id: 3, name: 'Solar' },
    { id: 4, name: 'Void' },
    { id: 6, name: 'Stasis' },
    { id: 7, name: 'Strand' }
  ];

  constructor(private fb: FormBuilder) {
    this.filterForm = this.fb.group({
      searchText: [''],
      itemType: [null],
      tierType: [null],
      damageType: [null],
      minimumPower: [null]
    });
  }

  ngOnInit(): void {
    this.filterForm.valueChanges
      .pipe(debounceTime(300))
      .subscribe(formValues => {
        const filter: VaultFilter = {};
        
        if (formValues.searchText) {
          filter.searchText = formValues.searchText;
        }
        
        if (formValues.itemType !== null) {
          filter.itemType = formValues.itemType;
        }
        
        if (formValues.tierType !== null) {
          filter.tierType = formValues.tierType;
        }
        
        if (formValues.damageType !== null) {
          filter.damageType = formValues.damageType;
        }
        
        if (formValues.minimumPower !== null) {
          filter.minimumPower = formValues.minimumPower;
        }
        
        this.filterChange.emit(filter);
      });
  }

  resetFilters(): void {
    this.filterForm.reset({
      searchText: '',
      itemType: null,
      tierType: null,
      damageType: null,
      minimumPower: null
    });
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }
}
