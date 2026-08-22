import { Directive, ElementRef, EventEmitter, HostListener, Output, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Emits `clickOutside` whenever a click happens outside the host element
 * (and outside any of its descendants). Usage:
 *
 *   <div (clickOutside)="close()"> ... trigger + panel ... </div>
 *
 * Angular matches the `[clickOutside]` selector against elements that have
 * an event binding named `clickOutside`, so no extra attribute is needed.
 */
@Directive({
  selector: '[clickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  @Output() clickOutside = new EventEmitter<Event>();

  private elementRef = inject(ElementRef<HTMLElement>);
  private platformId = inject(PLATFORM_ID);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const target = event.target as HTMLElement | null;
    const host = this.elementRef.nativeElement;

    if (target && host && !host.contains(target)) {
      this.clickOutside.emit(event);
    }
  }
}
