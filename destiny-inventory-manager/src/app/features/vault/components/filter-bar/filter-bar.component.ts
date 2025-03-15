import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-filter-bar',
  templateUrl: './filter-bar.component.html',
  styleUrls: ['./filter-bar.component.scss']
})
export class FilterBarComponent {
  @Output() filterChanged = new EventEmitter<string>();

  onFilterChange(filter: string): void {
    this.filterChanged.emit(filter);
  }
}
