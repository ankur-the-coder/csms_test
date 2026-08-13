import { Component, computed, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TrendLegendItem {
  label: string;
  value: string | number;
  pct?: number;
  colorClass: string;
  colorHex?: string;
}

export interface HealthSegment {
  label: string;
  range?: string;
  value: number;
  pct: number;
  colorClass: string;
  colorHex: string;
}

@Component({
  selector: 'app-charts',
  imports: [CommonModule],
  templateUrl: './charts.html',
  styleUrl: './charts.css',
})
export class Charts {
 
  @Input() type: 'trend' | 'donut' = 'trend';
  @Input() title: string = '';
  @Input() actionText: string = '';
  @Input() totalCount: number = 256;
  @Input() totalLabel: string = 'Total Clients';
  @Input() trendLegends: TrendLegendItem[] = [];
  @Input() healthSegments: HealthSegment[] = [];

  @Output() actionClick = new EventEmitter<void>();

  readonly defaultHealthSegments: HealthSegment[] = [
    { label: 'Excellent', range: '80-100', value: 120, pct: 47, colorClass: 'bg-emerald-500', colorHex: '#10b981' },
    { label: 'Good', range: '60-79', value: 86, pct: 34, colorClass: 'bg-teal-500', colorHex: '#14b8a6' },
    { label: 'Average', range: '40-59', value: 32, pct: 12, colorClass: 'bg-amber-400', colorHex: '#fbbf24' },
    { label: 'Poor', range: '0-39', value: 18, pct: 6, colorClass: 'bg-rose-500', colorHex: '#f43f5e' },
  ];

  readonly healthDonutGradient = computed(() => {
    const list = this.healthSegments.length ? this.healthSegments : this.defaultHealthSegments;
    let acc = 0;
    const stops = list.map(seg => {
      const start = acc;
      acc += seg.pct;
      return `${seg.colorHex} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  onActionClicked() {
    this.actionClick.emit();
  }
}
