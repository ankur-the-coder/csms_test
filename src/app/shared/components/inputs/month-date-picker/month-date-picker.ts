import {
  Component, Input, Output, EventEmitter,
  signal, computed, OnInit, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-month-date-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './month-date-picker.html',
  styleUrl: './month-date-picker.css'
})
export class MonthDatePicker implements OnInit, OnChanges {
  @Input() initialDate: Date = new Date();
  @Input() initialMode: 'month' | 'week' | 'day' = 'month';

  @Output() dateSelected = new EventEmitter<Date>();
  @Output() modeChange   = new EventEmitter<'month' | 'week' | 'day'>();
  @Output() closed       = new EventEmitter<void>();

  // ── Reactive state ──────────────────────────────────────
  activeTab    = signal<'month' | 'week' | 'day'>('month');
  selectedDate = signal<Date>(new Date());
  displayYear  = signal<number>(new Date().getFullYear());
  displayMonth = signal<number>(new Date().getMonth());

  readonly tabs: Array<'month' | 'week' | 'day'> = ['month', 'week', 'day'];

  readonly monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  readonly dowLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  // ── Lifecycle ───────────────────────────────────────────
  ngOnInit() {
    this.activeTab.set(this.initialMode);
    this._applyDate(this.initialDate);
  }

  ngOnChanges(ch: SimpleChanges) {
    if (ch['initialMode']) this.activeTab.set(this.initialMode);
    if (ch['initialDate']) this._applyDate(this.initialDate);
  }

  private _applyDate(d: Date) {
    this.selectedDate.set(new Date(d));
    this.displayYear.set(d.getFullYear());
    this.displayMonth.set(d.getMonth());
  }

  // ── Computed labels ─────────────────────────────────────
  readonly displayMonthLabel = computed(() =>
    `${this.monthNames[this.displayMonth()]} ${this.displayYear()}`
  );

  // ════════ MONTH tab ════════════════════════════════════
  isSelectedMonth(i: number): boolean {
    const s = this.selectedDate();
    return this.activeTab() === 'month'
      && s.getFullYear() === this.displayYear()
      && s.getMonth() === i;
  }

  isTodayMonth(i: number): boolean {
    const n = new Date();
    return n.getFullYear() === this.displayYear() && n.getMonth() === i;
  }

  selectMonth(i: number) {
    const d = new Date(this.displayYear(), i, 1);
    this.selectedDate.set(d);
    this.dateSelected.emit(d);
  }

  // ════════ WEEK tab ═════════════════════════════════════
  readonly weeksInMonth = computed(() => {
    const y = this.displayYear(), m = this.displayMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const startDow = first.getDay();
    const weeks: { label: string; start: Date; end: Date; num: number }[] = [];
    let cur = new Date(y, m, 1 - startDow);
    let n = 1;
    while (cur <= last) {
      const ws = new Date(cur);
      const we = new Date(cur); we.setDate(we.getDate() + 6);
      weeks.push({ label: `Week ${n}`, start: ws, end: we, num: n });
      cur.setDate(cur.getDate() + 7);
      n++;
    }
    return weeks;
  });

  isSelectedWeek(w: { start: Date; end: Date }): boolean {
    const s = this.selectedDate();
    return this.activeTab() === 'week' && s >= w.start && s <= w.end;
  }

  isTodayWeek(w: { start: Date; end: Date }): boolean {
    const now = new Date();
    return now >= w.start && now <= w.end;
  }

  formatWeekRange(start: Date, end: Date): string {
    const sm = start.toLocaleDateString('en-US', { month: 'short' });
    const em = end.toLocaleDateString('en-US', { month: 'short' });
    const yr = end.getFullYear();
    return sm === em
      ? `${sm} ${start.getDate()} - ${end.getDate()}, ${yr}`
      : `${sm} ${start.getDate()} - ${em} ${end.getDate()}, ${yr}`;
  }

  selectWeek(w: { start: Date; end: Date }) {
    const d = new Date(w.start);
    this.selectedDate.set(d);
    this.dateSelected.emit(d);
  }

  // ════════ DAY tab ══════════════════════════════════════
  readonly daysGrid = computed(() => {
    const y = this.displayYear(), m = this.displayMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const startDow = first.getDay();
    const days: Date[] = [];
    for (let i = startDow - 1; i >= 0; i--)
      days.push(new Date(y, m, -i));
    for (let d = 1; d <= last.getDate(); d++)
      days.push(new Date(y, m, d));
    while (days.length % 7 !== 0) {
      const prev = days[days.length - 1];
      const next = new Date(prev); next.setDate(next.getDate() + 1);
      days.push(next);
    }
    return days;
  });

  isSelectedDay(d: Date): boolean {
    return this.activeTab() === 'day'
      && d.toDateString() === this.selectedDate().toDateString();
  }

  isToday(d: Date): boolean {
    return d.toDateString() === new Date().toDateString();
  }

  isCurrentMonthDay(d: Date): boolean {
    return d.getMonth() === this.displayMonth();
  }

  selectDay(d: Date) {
    this.displayMonth.set(d.getMonth());
    this.displayYear.set(d.getFullYear());
    this.selectedDate.set(new Date(d));
    this.dateSelected.emit(new Date(d));
  }

  // ════════ Navigation ═══════════════════════════════════
  prevPeriod() {
    if (this.activeTab() === 'month') {
      this.displayYear.update(y => y - 1);
    } else {
      const m = this.displayMonth(), y = this.displayYear();
      if (m === 0) { this.displayMonth.set(11); this.displayYear.set(y - 1); }
      else { this.displayMonth.update(v => v - 1); }
    }
  }

  nextPeriod() {
    if (this.activeTab() === 'month') {
      this.displayYear.update(y => y + 1);
    } else {
      const m = this.displayMonth(), y = this.displayYear();
      if (m === 11) { this.displayMonth.set(0); this.displayYear.set(y + 1); }
      else { this.displayMonth.update(v => v + 1); }
    }
  }

  // ════════ Quick selectors ══════════════════════════════
  private _today(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }
  private _thisWeekStart(): Date {
    const d = this._today(); d.setDate(d.getDate() - d.getDay()); return d;
  }
  private _emit(d: Date) {
    this.displayYear.set(d.getFullYear());
    this.displayMonth.set(d.getMonth());
    this.selectedDate.set(d);
    this.dateSelected.emit(d);
  }

  selectThisMonth() { const n = this._today(); this._emit(new Date(n.getFullYear(), n.getMonth(), 1)); }
  selectLastMonth() { const n = this._today(); this._emit(new Date(n.getFullYear(), n.getMonth() - 1, 1)); }
  selectNextMonth() { const n = this._today(); this._emit(new Date(n.getFullYear(), n.getMonth() + 1, 1)); }

  selectThisWeek()  { this._emit(this._thisWeekStart()); }
  selectLastWeek()  { const d = this._thisWeekStart(); d.setDate(d.getDate() - 7); this._emit(d); }
  selectNextWeek()  { const d = this._thisWeekStart(); d.setDate(d.getDate() + 7); this._emit(d); }

  selectThisDay()   { this._emit(this._today()); }
  selectLastDay()   { const d = this._today(); d.setDate(d.getDate() - 1); this._emit(d); }
  selectNextDay()   { const d = this._today(); d.setDate(d.getDate() + 1); this._emit(d); }

  reset() { this._emit(this._today()); this.closed.emit(); }

  setTab(tab: 'month' | 'week' | 'day') {
    this.activeTab.set(tab);
    this.modeChange.emit(tab);
  }
}
