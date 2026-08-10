import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Calendar, DayEvent } from '../../../../shared/components/inputs/calendar/calendar';
import { Charts } from '../../../../shared/components/inputs/charts/charts';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, Calendar, Charts],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {

  constructor(private router: Router) {}

  navigateToImplementation() {
    this.router.navigate(['/implementation']);
  }

  // Health Score Distribution donut data
  readonly healthSegments = [
    { label: 'Excellent', range: '80-100', value: 120, pct: 47, colorClass: 'bg-emerald-500', colorHex: '#10b981' },
    { label: 'Good', range: '60-79', value: 86, pct: 34, colorClass: 'bg-teal-500', colorHex: '#14b8a6' },
    { label: 'Average', range: '40-59', value: 32, pct: 12, colorClass: 'bg-amber-400', colorHex: '#fbbf24' },
    { label: 'Poor', range: '0-39', value: 18, pct: 6, colorClass: 'bg-rose-500', colorHex: '#f43f5e' },
  ];

  readonly healthDonutGradient = computed(() => {
    let acc = 0;
    const stops = this.healthSegments.map(seg => {
      const start = acc;
      acc += seg.pct;
      return `${seg.colorHex} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  // Daily Tasks & Operations
  readonly dailyOps = [
    { label: 'Overdue Tasks', value: 16, pct: 92, danger: true, barClass: 'bg-rose-600' },
    { label: 'Pending Docs', value: 14, pct: 78, danger: false, barClass: 'bg-amber-500' },
    { label: 'Integrations', value: 9, pct: 52, danger: false, barClass: 'bg-purple-600' },
    { label: "Today's Meetings", value: 7, pct: 40, danger: false, barClass: 'bg-indigo-600' },
    { label: "Today's Trainings", value: 5, pct: 28, danger: false, barClass: 'bg-emerald-500' },
    { label: 'Installations', value: 3, pct: 18, danger: false, barClass: 'bg-cyan-500' },
  ];

  // Calendar Event Data — passed into <app-calendar [eventsByDay]="eventsByDay">
  readonly eventsByDay: Record<number, DayEvent[]> = {
    4: [
      this.mkEvent('Team Sync', 'Internal', '09:00 AM - 09:30 AM', '09:00 AM', 540, 570, 'bg-blue-50 text-blue-700 border border-blue-200', 'border-blue-500', '🤝'),
    ],
    7: this.buildDay7Events(),
    12: [
      this.mkEvent('Product Review', 'Internal', '11:00 AM - 12:00 PM', '11:00 AM', 660, 720, 'bg-blue-50 text-blue-700 border border-blue-200', 'border-blue-500', '📋'),
    ],
  };

  private mkEvent(
    title: string, client: string, timeLabel: string, startTime: string,
    startMinutes: number, endMinutes: number, chipClass: string, accentClass: string, icon: string
  ): DayEvent {
    return { title, client, timeLabel, startTime, startMinutes, endMinutes, chipClass, accentClass, icon };
  }

  private buildDay7Events(): DayEvent[] {
    const events: DayEvent[] = [
      this.mkEvent('Admin Training', 'ABC Ind.', '10:00 AM - 11:30 AM', '10:00 AM', 600, 690, 'bg-indigo-50 text-indigo-700 border border-indigo-200', 'border-indigo-500', '🎓'),
      this.mkEvent('Impl. Meeting', 'XYZ Ltd', '12:00 PM - 01:00 PM', '12:00 PM', 720, 780, 'bg-rose-50 text-rose-700 border border-rose-200', 'border-indigo-600', '🚀'),
      this.mkEvent('Installation', 'PQR Sol.', '02:30 PM - 04:00 PM', '02:30 PM', 870, 960, 'bg-amber-50 text-amber-700 border border-amber-200', 'border-amber-500', '🛠️'),
    ];

    const templates = [
      { title: 'Dev Sync', client: 'GlobalTech' },
      { title: 'Executive Review', client: 'Nexus Ltd' },
      { title: 'Sales Demo', client: 'Apex Systems' },
      { title: '1-on-1 Checkin', client: 'Starlight Inc' },
      { title: 'Client Onboarding', client: 'Acme Corp' },
    ];

    let hour = 9, minute = 45;
    for (let i = 0; i < 101; i++) {
      const t = templates[i % templates.length];
      const num = i + 4;
      const startMinutes = hour * 60 + minute;
      const label = this.formatClock(hour, minute);
      events.push(
        this.mkEvent(`${t.title} #${num}`, t.client, label, label, startMinutes, startMinutes + 30,
          'bg-indigo-50 text-indigo-700 border border-indigo-200', 'border-indigo-500', '📅')
      );
      minute += 15;
      if (minute >= 60) { minute -= 60; hour += 1; }
      if (hour >= 24) hour = 0;
    }
    return events;
  }

  private formatClock(hour: number, minute: number): string {
    const h12 = ((hour + 11) % 12) + 1;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
  }
}
