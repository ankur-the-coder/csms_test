import {
  Directive,
  Input,
  TemplateRef
} from '@angular/core';

@Directive({
  selector: '[appCustomColumn]',
  standalone: true
})
export class CustomColumnDirective {

  @Input('appCustomColumn')
  columnName!: string;

  constructor(
    public template: TemplateRef<any>
  ) {}

}