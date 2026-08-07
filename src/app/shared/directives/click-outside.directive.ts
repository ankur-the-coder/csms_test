import { Directive, ElementRef, EventEmitter, Output } from '@angular/core';

@Directive({
  selector: '[appClickOutside]',
  standalone: true,
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ClickOutsideDirective {
  @Output() clickOutside = new EventEmitter<void>();

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  onDocumentClick(event: MouseEvent) {
    const target = event.target as Node | null;
    if (!target || this.elementRef.nativeElement.contains(target)) {
      return;
    }

    this.clickOutside.emit();
  }
}
