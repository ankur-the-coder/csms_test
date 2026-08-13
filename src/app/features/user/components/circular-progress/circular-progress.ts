import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-circular-progress',
  imports: [CommonModule],
  templateUrl: './circular-progress.html',
  styleUrl: './circular-progress.css',
})
export class CircularProgress {
  @Input() percent = 0;
  @Input() size = 64; // px

  get strokeWidth(): number {
    return Math.max(3, this.size * 0.07);
  }

  get radius(): number {
    return (this.size - this.strokeWidth * 2) / 2;
  }

  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  get dashOffset(): number {
    const clamped = Math.min(100, Math.max(0, this.percent));
    return this.circumference - (clamped / 100) * this.circumference;
  }

  get strokeColor(): string {
    if (this.percent >= 100) return '#10b981'; // emerald-500
    if (this.percent > 0)   return '#f59e0b';  // amber-400
    return '#cbd5e1';                          // slate-300
  }
}
