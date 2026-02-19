import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter',
  standalone: true
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], filter: (item: any) => boolean): any[] {
    if (!items || !filter) {
      return items;
    }
    return items.filter(filter);
  }
}