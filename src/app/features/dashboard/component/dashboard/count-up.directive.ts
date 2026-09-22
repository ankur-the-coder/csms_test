import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';

@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges {
  private readonly el = inject(ElementRef<HTMLElement>);

  /** Target number to count up to */
  @Input('appCountUp') value: number = 0;

  /** Animation duration in ms */
  @Input() countDuration = 800;

  /** Decimal places (for % values like 39.13) */
  @Input() decimals = 0;

  /** Optional suffix, e.g. '%' */
  @Input() suffix = '';

  private currentValue = 0;
  private rafId: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      const from = this.currentValue;
      const to = Number(this.value) || 0;
      this.animate(from, to);
    }
  }

  private animate(from: number, to: number): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    const start = performance.now();
    const duration = this.countDuration;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutQuad for a nice deceleration feel
      const eased = 1 - (1 - progress) * (1 - progress);

      const current = from + (to - from) * eased;
      this.currentValue = current;

      this.el.nativeElement.textContent =
        current.toFixed(this.decimals) + this.suffix;

      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.currentValue = to;
        this.el.nativeElement.textContent =
          to.toFixed(this.decimals) + this.suffix;
      }
    };

    this.rafId = requestAnimationFrame(step);
  }
}
