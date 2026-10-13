import { Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';

/** <span [pCountUp]="482" pSuffix="%"></span>  — eases from 0 to the value. */
@Directive({ selector: '[pCountUp]', standalone: true })
export class PortalCountUp implements OnChanges, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  @Input('pCountUp') value = 0;
  @Input() pDuration = 1100;
  @Input() pSuffix = '';
  private raf: number | null = null;
  private shown = 0;

  ngOnChanges(): void {
    if (typeof window === 'undefined') { this.el.nativeElement.textContent = this.value + this.pSuffix; return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { this.write(this.value); return; }
    const from = this.shown, to = Number(this.value) || 0, t0 = performance.now();
    if (this.raf) cancelAnimationFrame(this.raf);
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / this.pDuration);
      this.write(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  private write(v: number) {
    this.shown = v;
    this.el.nativeElement.textContent = Math.round(v).toLocaleString('en-IN') + this.pSuffix;
  }
  ngOnDestroy(): void { if (this.raf) cancelAnimationFrame(this.raf); }
}