import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DayEvent {
  title: string;
  client: string;
  timeLabel: string;   // "10:00 AM - 11:30 AM"
  startTime: string;   // "09:45 AM"
  startMinutes: number; // minutes since midnight
  endMinutes: number;
  chipClass?: string;   // month-view chip colors
  accentClass?: string; // week/day-view left border accent
  icon?: string;
}

export interface TimeSlot {
  hour: number;
  label: string;
  events: DayEvent[];
}

export interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  visibleEvents: DayEvent[];
  allEvents: DayEvent[];
  moreCount: number;
}

@Component({
  selector: 'app-calendar',
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class Calendar {
  @Input() eventsByDay: Record<number, DayEvent[]> = {};
  @Output() eventClick = new EventEmitter<DayEvent>();
  @Output() dateSelect = new EventEmitter<Date>();
  @Output() viewModeChange = new EventEmitter<'day' | 'week' | 'month'>();

  viewMode = signal<'day' | 'week' | 'month'>('month');
  readonly viewModes: Array<'day' | 'week' | 'month'> = ['day', 'week', 'month'];
  anchorDate = signal<Date>(new Date());

  scheduleDrawerOpen = signal(false);
  scheduleDrawerDate = signal<Date | null>(null);
  scheduleSearch = signal('');

  private sameDay(a: Date, b: Date): boolean {
    return a.toDateString() === b.toDateString();
  }

  private getEventsForDate(date: Date, isCurrentMonth = true): DayEvent[] {
    if (!isCurrentMonth) return [];
    return this.eventsByDay[date.getDate()] ?? [];
  }

  private buildCalendarDay(date: Date, isCurrentMonth: boolean): CalendarDay {
    const today = new Date();
    const rawEvents = this.getEventsForDate(date, isCurrentMonth);
    const allEvents = [...rawEvents].sort((a, b) => a.startMinutes - b.startMinutes);
    const visibleEvents = allEvents.slice(0, 2);
    return {
      date,
      dayNumber: date.getDate(),
      isCurrentMonth,
      isToday: this.sameDay(date, today),
      isSelected: this.sameDay(date, this.anchorDate()),
      visibleEvents,
      allEvents,
      moreCount: Math.max(0, allEvents.length - visibleEvents.length),
    };
  }

  // Month View
  readonly monthLabel = computed(() =>
    this.anchorDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  readonly calendarWeeks = computed<CalendarDay[][]>(() => {
    const ref = this.anchorDate();
    const year = ref.getFullYear();
    const month = ref.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - firstWeekday);

    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      days.push(this.buildCalendarDay(date, date.getMonth() === month));
    }

    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    const lastWeekIsAllNextMonth = weeks[weeks.length - 1].every(d => !d.isCurrentMonth);
    return lastWeekIsAllNextMonth ? weeks.slice(0, -1) : weeks;
  });

  // Week View
  readonly weekDays = computed<CalendarDay[]>(() => {
    const ref = this.anchorDate();
    const weekday = (ref.getDay() + 6) % 7;
    const weekStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - weekday);
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
      days.push(this.buildCalendarDay(date, true));
    }
    return days;
  });

  readonly weekRangeLabel = computed(() => {
    const days = this.weekDays();
    const start = days[0].date;
    const end = days[6].date;
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  });

  // Day View
  readonly dayViewHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  readonly selectedDay = computed<CalendarDay>(() => this.buildCalendarDay(this.anchorDate(), true));

  readonly dayLabel = computed(() =>
    this.anchorDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  );

  readonly dayTimeSlots = computed<TimeSlot[]>(() => {
    const day = this.selectedDay();
    const allEvents = day.allEvents;
    const hours = this.dayViewHours;

    return hours.map(h => {
      const h12 = ((h + 11) % 12) + 1;
      const ampm = h < 12 ? 'AM' : 'PM';
      const label = `${String(h12).padStart(2, '0')}:00 ${ampm}`;

      const slotEvents = allEvents.filter(ev => {
        if (h === 8) return ev.startMinutes < 9 * 60;
        if (h === 20) return ev.startMinutes >= 20 * 60;
        return ev.startMinutes >= h * 60 && ev.startMinutes < (h + 1) * 60;
      });

      return {
        hour: h,
        label,
        events: slotEvents,
      };
    });
  });

  isEventNow(ev: DayEvent, day: CalendarDay): boolean {
    if (!day.isToday) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes >= ev.startMinutes && nowMinutes <= ev.endMinutes;
  }

  setViewMode(mode: 'day' | 'week' | 'month') {
    this.viewMode.set(mode);
    this.viewModeChange.emit(mode);
  }

  selectDay(date: Date) {
    this.anchorDate.set(date);
    this.dateSelect.emit(date);
  }

  goToToday() {
    this.anchorDate.set(new Date());
  }

  goPrev() {
    const d = this.anchorDate();
    if (this.viewMode() === 'month') this.anchorDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (this.viewMode() === 'week') this.anchorDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
    else this.anchorDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  }

  goNext() {
    const d = this.anchorDate();
    if (this.viewMode() === 'month') this.anchorDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (this.viewMode() === 'week') this.anchorDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    else this.anchorDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  }

  // Schedule Drawer
  openScheduleDrawer(day: CalendarDay) {
    if (day.allEvents.length === 0) return;
    this.scheduleDrawerDate.set(day.date);
    this.scheduleSearch.set('');
    this.scheduleDrawerOpen.set(true);
  }

  closeScheduleDrawer() {
    this.scheduleDrawerOpen.set(false);
  }

  readonly scheduleDrawerDateLabel = computed(() => {
    const d = this.scheduleDrawerDate();
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  readonly scheduleDrawerEvents = computed<DayEvent[]>(() => {
    const d = this.scheduleDrawerDate();
    if (!d) return [];
    return this.getEventsForDate(d, true);
  });

  readonly scheduleDrawerFiltered = computed<DayEvent[]>(() => {
    const q = this.scheduleSearch().toLowerCase().trim();
    const all = this.scheduleDrawerEvents();
    if (!q) return all;
    return all.filter(e => e.title.toLowerCase().includes(q) || e.client.toLowerCase().includes(q));
  });

  onEventClicked(ev: DayEvent) {
    this.eventClick.emit(ev);
  }
}
