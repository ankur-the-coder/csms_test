import { CommonModule, NgClass, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  ViewChild,
  OnInit,
  AfterContentInit,
  OnDestroy,
  OnChanges,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface DateRangeOutput {
  from: string;
  to: string;
}

@Component({
  selector: 'app-custom-date-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass],
  templateUrl: './custom-date-selector.html',
  styleUrl: './custom-date-selector.css',
})
export class CustomDateSelector implements OnInit, AfterContentInit, OnDestroy, OnChanges {
  readonly id = 'cds_' + Math.random().toString(36).substring(2, 9);

  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() placeholder: string = 'Select Date Range';
  @Input() setMinDate: Date | null = null;
  @Input() setMaxDate: Date | null = null;
  @Input() toggle: boolean = true;
  @Input() initialDates: { from: string | Date; to: string | Date } = { from: '', to: '' };
  @Input() preDefinedPresent: string = '';
  @Input() selectedDays: number = 0;
  @Input() showEmpty: boolean = false;
  @Input() defaultPreset:
    'today' | 'currentMonth' | 'lastWeek' | 'last90days' | 'yesterday' | 'custom' | string = 'today';
  @Input() disableFutureDates: boolean = false;
  @Input() disablePastDates: boolean = false;

  @Output() onApplyDate = new EventEmitter<DateRangeOutput>();

  @ViewChild('yearDropdown') yearDropdownElement!: ElementRef<HTMLDivElement>;
  @ViewChild('monthDropdown') monthDropdownElement!: ElementRef<HTMLDivElement>;

  datePickerPosition: string = 'left-0';
  showDatePicker = false;
  currentMonth: Date = new Date();
  selectedStartDate: Date | null = null;
  selectedEndDate: Date | null = null;
  submittedStartDate: Date | null = null;
  submittedEndDate: Date | null = null;

  days: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  firstDayOfMonth: number = 0;
  monthDates: Date[] = [];
  emptyDays: number[] = [];
  trailingDays: number[] = [];
  selectedPreset: string | null = null;
  previousPreset: string | null = null;

  presets = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'lastWeek', label: 'Last 7 Days' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'currentMonth', label: 'Current Month' },
    { key: 'last90days', label: 'Last 90 Days' },
    { key: 'custom', label: 'Custom Date' },
  ];

  private dateRangeYears: number = 10;
  private currentDate: Date = new Date();

  disabled: boolean = false;
  hoveredDate: Date | null = null;

  months: string[] = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  showMonthDropdown: boolean = false;
  showYearDropdown: boolean = false;
  yearRange: number[] = [];
  isSelectingRange: boolean = false;

  private isBrowser: boolean;

  constructor(
    private elementRef: ElementRef,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.generateYearRange();

    if (!this.showEmpty) {
      if (this.preDefinedPresent && this.preDefinedPresent !== '') {
        this.selectPreset(this.preDefinedPresent);
        this.applyDateRange();
      }

      this.selectedStartDate ??= new Date();
      this.selectedEndDate ??= new Date();
      this.updateSelectedPreset();
    }

    this.disabled = this.selectedDays > 0;
  }

  ngAfterContentInit(): void {
    if (!this.showEmpty) {
      if (this.initialDates.from === '' && !this.preDefinedPresent) {
        this.initialDates = { from: new Date(), to: new Date() };
        this.selectPreset(this.defaultPreset);
        this.applyDateRange();
      } else {
        this.submittedStartDate = this.selectedStartDate;
        this.submittedEndDate = this.selectedEndDate;
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialDates'] && this.initialDates) {
      if (typeof this.initialDates.from === 'string' && this.initialDates.from !== '') {
        this.selectedStartDate = this.parseLocalDate(this.initialDates.from);
      } else if (this.initialDates.from instanceof Date) {
        this.selectedStartDate = this.normalizeDate(this.initialDates.from);
      } else {
        this.selectedStartDate = null;
      }

      if (typeof this.initialDates.to === 'string' && this.initialDates.to !== '') {
        this.selectedEndDate = this.parseLocalDate(this.initialDates.to);
      } else if (this.initialDates.to instanceof Date) {
        this.selectedEndDate = this.normalizeDate(this.initialDates.to);
      } else {
        this.selectedEndDate = null;
      }

      this.submittedStartDate = this.selectedStartDate;
      this.submittedEndDate = this.selectedEndDate;

      if (!this.selectedStartDate || !this.selectedEndDate) {
        this.selectedPreset = null;
      } else {
        this.updateSelectedPreset();
        this.currentMonth = new Date(
          this.selectedStartDate.getFullYear(),
          this.selectedStartDate.getMonth(),
          1,
        );
      }

      this.renderCalendar(this.currentMonth);
    }
  }

  ngOnDestroy(): void {}

  private updateSelectedPreset(): void {
    if (!this.selectedStartDate || !this.selectedEndDate) return;

    const diffTime = this.selectedEndDate.getTime() - this.selectedStartDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;

    const lastDayOfCurrentMonth = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      0,
    );

    const isFirstDayOfCurrentMonth = this.selectedStartDate.getDate() === 1;
    const isEndDateBeforeOrEqualLastDayOfCurrentMonth =
      this.selectedEndDate <= lastDayOfCurrentMonth;

    if (
      isFirstDayOfCurrentMonth &&
      isEndDateBeforeOrEqualLastDayOfCurrentMonth &&
      diffDays > 1 &&
      diffDays !== 7
    ) {
      this.selectedPreset = 'currentMonth';
    } else if (diffDays >= 28 && diffDays <= 31) {
      this.selectedPreset = 'currentMonth';
    } else if (diffDays === 7) {
      this.selectedPreset = 'lastWeek';
    } else if (diffDays <= 1) {
      this.selectedPreset = 'today';
    } else {
      this.selectedPreset = 'custom';
    }
  }

  toggleDatePicker(event?: MouseEvent): void {
    if (!this.toggle) return;

    if (!this.showDatePicker) {
      this.currentMonth = new Date(
        (this.selectedEndDate || this.currentDate).getFullYear(),
        (this.selectedEndDate || this.currentDate).getMonth(),
        1,
      );
      this.renderCalendar(this.currentMonth);
      this.showDatePicker = true;
      this.isSelectingRange = false;

      if (event) {
        this.calculatePosition(event);
      }
    } else {
      this.closeDatePicker();
    }
  }

  private calculatePosition(event: MouseEvent): void {
    if (!this.isBrowser) return;

    const buttonElement = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const pickerWidth = 360;

    if (buttonElement.left + pickerWidth > viewportWidth) {
      this.datePickerPosition = 'right-0';
    } else {
      this.datePickerPosition = 'left-0';
    }
  }

  clearDates(): void {
    this.selectedStartDate = null;
    this.selectedEndDate = null;
    this.submittedStartDate = null;
    this.submittedEndDate = null;
    this.selectedPreset = null;
    this.previousPreset = null;
    this.onApplyDate.emit({ from: '', to: '' });
    this.closeDatePicker();
  }

  closeDatePicker(): void {
    this.showDatePicker = false;
    this.showMonthDropdown = false;
    this.showYearDropdown = false;
    this.isSelectingRange = false;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.isBrowser) return;

    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      if (this.showDatePicker) {
        this.closeDatePicker();
      }
    }
  }

  get minDate(): Date {
    if (this.disablePastDates) {
      const todayNormalized = this.normalizeDate(new Date());
      // if an explicit setMinDate is later than today, respect that instead
      return this.setMinDate && this.setMinDate > todayNormalized
        ? this.setMinDate
        : todayNormalized;
    }
    if (this.setMinDate) return this.setMinDate;
    const min = new Date(this.currentDate);
    min.setFullYear(min.getFullYear() - this.dateRangeYears);
    return min;
  }

  get maxDate(): Date {
    if (this.disableFutureDates) {
      const todayNormalized = this.normalizeDate(new Date());
      // if an explicit setMaxDate is earlier than today, respect that instead
      return this.setMaxDate && this.setMaxDate < todayNormalized
        ? this.setMaxDate
        : todayNormalized;
    }
    if (this.setMaxDate) return this.setMaxDate;
    const max = new Date(this.currentDate);
    max.setFullYear(max.getFullYear() + this.dateRangeYears);
    return max;
  }

  /** True when `date` falls outside the allowed [minDate, maxDate] window. */
  isDateDisabled(date: Date): boolean {
    const normalizedDate = this.normalizeDate(date);
    const normalizedMin = this.minDate ? this.normalizeDate(this.minDate) : null;
    const normalizedMax = this.maxDate ? this.normalizeDate(this.maxDate) : null;
    return (
      !!(normalizedMin && normalizedDate < normalizedMin) ||
      !!(normalizedMax && normalizedDate > normalizedMax)
    );
  }

  /** True when the month containing `monthIndex` (within currentMonth's year) is fully out of range. */
  isMonthDisabled(monthIndex: number): boolean {
    const candidate = new Date(this.currentMonth.getFullYear(), monthIndex, 1);
    if (this.disableFutureDates) {
      const maxNormalized = this.normalizeDate(this.maxDate);
      if (candidate > new Date(maxNormalized.getFullYear(), maxNormalized.getMonth(), 1))
        return true;
    }
    if (this.disablePastDates) {
      const minNormalized = this.normalizeDate(this.minDate);
      if (candidate < new Date(minNormalized.getFullYear(), minNormalized.getMonth(), 1))
        return true;
    }
    return false;
  }

  /** True when `year` is fully out of range. */
  isYearDisabled(year: number): boolean {
    if (this.disableFutureDates) {
      const maxNormalized = this.normalizeDate(this.maxDate);
      if (year > maxNormalized.getFullYear()) return true;
    }
    if (this.disablePastDates) {
      const minNormalized = this.normalizeDate(this.minDate);
      if (year < minNormalized.getFullYear()) return true;
    }
    return false;
  }

  /** Whether the next-month arrow should be enabled. */
  canGoNextMonth(): boolean {
    if (!this.disableFutureDates) return true;
    const maxNormalized = this.normalizeDate(this.maxDate);
    const nextMonthDate = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + 1,
      1,
    );
    return nextMonthDate <= maxNormalized;
  }

  /** Whether the prev-month arrow should be enabled. */
  canGoPrevMonth(): boolean {
    if (!this.disablePastDates) return true;
    const minNormalized = this.normalizeDate(this.minDate);
    const prevMonthLastDay = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth(),
      0,
    );
    return prevMonthLastDay >= minNormalized;
  }

  renderCalendar(date: Date): void {
    this.firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    this.emptyDays = Array(this.firstDayOfMonth).fill(0);

    const lastDateOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    this.monthDates = [];
    for (let i = 1; i <= lastDateOfMonth; i++) {
      this.monthDates.push(new Date(date.getFullYear(), date.getMonth(), i));
    }

    const totalCells = 42;
    const filledCells = this.emptyDays.length + this.monthDates.length;
    this.trailingDays = Array(totalCells - filledCells).fill(0);
  }

  prevMonth(): void {
    if (!this.canGoPrevMonth()) return;
    const newMonth = new Date(this.currentMonth);
    newMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.currentMonth = newMonth;
    this.renderCalendar(this.currentMonth);
  }

  nextMonth(): void {
    if (!this.canGoNextMonth()) return;
    const newMonth = new Date(this.currentMonth);
    newMonth.setMonth(this.currentMonth.getMonth() + 1);
    this.currentMonth = newMonth;
    this.renderCalendar(this.currentMonth);
  }

  reset(): void {
    this.selectedStartDate = null;
    this.selectedEndDate = null;
    this.selectPreset('today');
  }

  getFormattedDateRange(): string {
    const start = this.formatDate(this.submittedStartDate);
    const end = this.formatDate(this.submittedEndDate || this.submittedStartDate);

    if (start) {
      return `${start} - ${end}`;
    }
    return '';
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  isActivePreset(preset: string): boolean {
    return this.selectedPreset === preset;
  }

  isSameDate(date1: Date | null, date2: Date | null): boolean {
    if (!date1 || !date2) return false;
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  isDateInRange(date: Date): boolean {
    if (!this.selectedStartDate) return false;
    if (!this.selectedEndDate) return this.isSameDate(date, this.selectedStartDate);

    const startDate = this.normalizeDate(this.selectedStartDate);
    const endDate = this.normalizeDate(this.selectedEndDate);
    const checkDate = this.normalizeDate(date);

    return checkDate >= startDate && checkDate <= endDate;
  }

  isDateHovered(date: Date): boolean {
    if (!this.hoveredDate) return false;

    if (this.selectedStartDate && this.isSelectingRange) {
      const startDate = this.normalizeDate(this.selectedStartDate);
      const hoverDate = this.normalizeDate(this.hoveredDate);
      const checkDate = this.normalizeDate(date);

      if (hoverDate >= startDate) {
        return checkDate >= startDate && checkDate <= hoverDate;
      }
    }

    return this.isSameDate(date, this.hoveredDate);
  }

  hoverDate(date: Date): void {
    this.hoveredDate = date;
  }

  clearHover(): void {
    this.hoveredDate = null;
  }

  getCurrentMonth(currentMonth: Date | string | null): string {
    const date = currentMonth ? new Date(currentMonth) : null;
    return date && !isNaN(date.getTime())
      ? date.toLocaleString('default', { month: 'long' })
      : 'Invalid month';
  }

  cancelSelection() {
    if (this.submittedStartDate) this.selectedStartDate = this.submittedStartDate;
    if (this.submittedEndDate) this.selectedEndDate = this.submittedEndDate;
    if (this.previousPreset) this.selectedPreset = this.previousPreset;
    this.closeDatePicker();
  }

  generateYearRange() {
    const currentYear = this.currentDate.getFullYear();
    this.yearRange = [];
    const startYear = currentYear - 10;
    const endYear = currentYear + 10;
    for (let year = startYear; year <= endYear; year++) {
      this.yearRange.push(year);
    }
  }

  toggleMonthDropdown(event: Event) {
    event.stopPropagation();
    this.showMonthDropdown = !this.showMonthDropdown;
    this.showYearDropdown = false;

    if (this.showMonthDropdown && this.isBrowser) {
      setTimeout(() => {
        if (!this.monthDropdownElement) return;
        const selectedMonthElement =
          this.monthDropdownElement.nativeElement.querySelector('.bg-indigo-50');
        if (selectedMonthElement) {
          selectedMonthElement.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      });
    }
  }

  toggleYearDropdown(event: Event) {
    event.stopPropagation();
    this.showYearDropdown = !this.showYearDropdown;
    this.showMonthDropdown = false;

    if (this.showYearDropdown && this.isBrowser) {
      setTimeout(() => {
        if (!this.yearDropdownElement) return;
        const selectedYearElement =
          this.yearDropdownElement.nativeElement.querySelector('.bg-indigo-50');
        if (selectedYearElement) {
          selectedYearElement.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      }, 0);
    }
  }

  selectMonth(monthIndex: number) {
    if (this.isMonthDisabled(monthIndex)) return;
    const newDate = new Date(this.currentMonth);
    newDate.setMonth(monthIndex);
    this.currentMonth = newDate;
    this.renderCalendar(this.currentMonth);
    this.showMonthDropdown = false;
  }

  selectYear(year: number) {
    if (this.isYearDisabled(year)) return;
    const newDate = new Date(this.currentMonth);
    newDate.setFullYear(year);
    this.currentMonth = newDate;
    this.renderCalendar(this.currentMonth);
    this.showYearDropdown = false;
  }

  private clampRange(start: Date, end: Date): { start: Date; end: Date } {
    let newStart = start;
    let newEnd = end;

    if (this.disableFutureDates) {
      const maxNormalized = this.normalizeDate(this.maxDate);
      if (newEnd > maxNormalized) newEnd = maxNormalized;
      if (newStart > maxNormalized) newStart = maxNormalized;
    }

    if (this.disablePastDates) {
      const minNormalized = this.normalizeDate(this.minDate);
      if (newStart < minNormalized) newStart = minNormalized;
      if (newEnd < minNormalized) newEnd = minNormalized;
    }

    if (newStart > newEnd) newStart = newEnd;

    return { start: newStart, end: newEnd };
  }

  private normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  }

  private parseLocalDate(dateString: string): Date {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day, 12, 0, 0, 0);
    }
    return this.normalizeDate(new Date(dateString));
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
    result.setDate(result.getDate() + days);
    return result;
  }

  private parsePresetDays(preset: string | null): number | null {
    const normalized = (preset ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (!normalized) return null;

    const match = normalized.match(/^(?:last)?(\d+)days?$/);
    if (!match) return null;

    const value = Number(match[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private computeShiftedRange(direction: number): { start: Date; end: Date } | null {
    if (!this.selectedStartDate || !this.selectedEndDate) return null;

    let newStart: Date;
    let newEnd: Date;
    const numericPresetDays = this.parsePresetDays(this.selectedPreset);

    switch (this.selectedPreset) {
      case 'today':
      case 'yesterday':
        newStart = this.addDays(this.selectedStartDate, direction);
        newEnd = this.addDays(this.selectedEndDate, direction);
        break;

      case 'lastWeek':
        newStart = this.addDays(this.selectedStartDate, 7 * direction);
        newEnd = this.addDays(this.selectedEndDate, 7 * direction);
        break;

      case 'lastMonth':
      case 'currentMonth': {
        const currentStart = this.selectedStartDate;
        const newMonth = currentStart.getMonth() + direction;
        const newYear = currentStart.getFullYear() + Math.floor(newMonth / 12);
        const adjustedMonth = ((newMonth % 12) + 12) % 12;

        newStart = new Date(newYear, adjustedMonth, 1, 12, 0, 0, 0);
        const lastDay = new Date(newYear, adjustedMonth + 1, 0).getDate();
        newEnd = new Date(newYear, adjustedMonth, lastDay, 12, 0, 0, 0);
        break;
      }

      case 'last90days':
        newStart = this.addDays(this.selectedStartDate, 90 * direction);
        newEnd = this.addDays(this.selectedEndDate, 90 * direction);
        break;

      case 'custom': {
        const diffInDays = Math.round(
          (this.selectedEndDate.getTime() - this.selectedStartDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        newStart = this.addDays(this.selectedStartDate, direction * (diffInDays + 1));
        newEnd = this.addDays(this.selectedEndDate, direction * (diffInDays + 1));
        break;
      }

      default:
        if (numericPresetDays) {
          newStart = this.addDays(this.selectedStartDate, numericPresetDays * direction);
          newEnd = this.addDays(this.selectedEndDate, numericPresetDays * direction);
          break;
        }
        return null;
    }

    return { start: newStart, end: newEnd };
  }

  canShiftDate(direction: number): boolean {
    if (!this.selectedStartDate || !this.selectedEndDate) return false;

    if (direction > 0 && this.disableFutureDates) {
      const maxNormalized = this.normalizeDate(this.maxDate);
      // already at (or past) today — nothing further forward to show
      if (this.normalizeDate(this.selectedEndDate) >= maxNormalized) return false;
    }

    if (direction < 0 && this.disablePastDates) {
      const minNormalized = this.normalizeDate(this.minDate);
      // already at (or before) the earliest allowed date — nothing further back to show
      if (this.normalizeDate(this.selectedStartDate) <= minNormalized) return false;
    }

    return true;
  }

  shiftDateRange(direction: number, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.selectedStartDate || !this.selectedEndDate) return;
    if (!this.canShiftDate(direction)) return; // blocks only once we're already at the boundary

    const shifted = this.computeShiftedRange(direction);
    if (!shifted) return;


    if (this.setMaxDate) {
      const normalizedMax = this.normalizeDate(this.setMaxDate);
      if (shifted.end > normalizedMax) shifted.end = normalizedMax;
    }
    if (this.setMinDate) {
      const normalizedMin = this.normalizeDate(this.setMinDate);
      if (shifted.start < normalizedMin) shifted.start = normalizedMin;
    }

    const clamped = this.clampRange(shifted.start, shifted.end);

    this.selectedStartDate = clamped.start;
    this.selectedEndDate = clamped.end;

    this.currentMonth = new Date(
      this.selectedStartDate.getFullYear(),
      this.selectedStartDate.getMonth(),
      1,
    );
    this.renderCalendar(this.currentMonth);
    this.applyDateRange();
  }

  applyDateRange(): void {
    if (this.selectedStartDate && !this.selectedEndDate) {
      this.selectedEndDate = this.selectedStartDate;
    }

    this.submittedStartDate = this.selectedStartDate;
    this.submittedEndDate = this.selectedEndDate;

    if (this.selectedPreset && this.selectedStartDate && this.selectedEndDate) {
      this.previousPreset = this.selectedPreset;
    }

    if (this.selectedStartDate && this.selectedEndDate) {
      this.onApplyDate.emit({
        from: this.formatDateToString(this.selectedStartDate),
        to: this.formatDateToString(this.selectedEndDate),
      });
    }

    this.closeDatePicker();
  }

  selectPreset(preset: string): void {
    const today = this.normalizeDate(new Date());
    const requestedPreset = String(preset ?? '').trim();
    const normalizedPreset = requestedPreset.toLowerCase().replace(/\s+/g, '');
    const numericPresetDays = this.parsePresetDays(normalizedPreset);
    let startDate: Date;
    let endDate: Date;

    if (this.selectedPreset && !this.previousPreset) {
      this.previousPreset = this.selectedPreset;
    }
    this.selectedPreset = requestedPreset || 'today';
    this.isSelectingRange = false;

    switch (normalizedPreset) {
      case 'today':
        startDate = endDate = today;
        break;
      case 'yesterday':
        startDate = endDate = this.addDays(today, -1);
        break;
      case 'lastweek':
        const currentDay = today.getDay();
        const daysSinceLastMonday = (currentDay + 6) % 7;
        startDate = this.addDays(today, -(daysSinceLastMonday + 7));
        endDate = this.addDays(startDate, 6);
        break;
      case 'lastmonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12, 0, 0, 0);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0, 12, 0, 0, 0);
        break;
      case 'currentmonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        endDate = new Date(today.getFullYear(), today.getMonth(), lastDay, 12, 0, 0, 0);
        break;
      case 'last90days':
        startDate = this.addDays(today, -90);
        endDate = today;
        break;
      default:
        if (numericPresetDays) {
          startDate = this.addDays(today, -(numericPresetDays - 1));
          endDate = today;
          break;
        }
        return;
    }

    const clamped = this.clampRange(startDate, endDate);
    this.selectedStartDate = clamped.start;
    this.selectedEndDate = clamped.end;
    this.currentMonth = new Date(clamped.start.getFullYear(), clamped.start.getMonth(), 1);
    this.renderCalendar(this.currentMonth);
  }

  selectDate(date: Date): void {
    if (this.isDateDisabled(date)) return;

    if (!this.previousPreset) this.previousPreset = this.selectedPreset;

    const normalizedDate = this.normalizeDate(date);
    const normalizedMin = this.minDate ? this.normalizeDate(this.minDate) : null;
    const normalizedMax = this.maxDate ? this.normalizeDate(this.maxDate) : null;

    if (
      (normalizedMin && normalizedDate < normalizedMin) ||
      (normalizedMax && normalizedDate > normalizedMax)
    )
      return;

    this.selectedPreset = 'custom';

    if (!this.isSelectingRange) {
      this.selectedStartDate = normalizedDate;
      this.selectedEndDate = normalizedDate;
      this.isSelectingRange = true;
    } else {
      if (this.selectedStartDate && normalizedDate < this.selectedStartDate) {
        this.selectedStartDate = normalizedDate;
        this.selectedEndDate = normalizedDate;
        this.isSelectingRange = true;
        return;
      } else {
        this.selectedEndDate = normalizedDate;
      }
      this.isSelectingRange = false;
    }

    if (this.selectedStartDate && this.selectedEndDate && this.selectedDays > 0) {
      const diffInDays = Math.ceil(
        Math.abs(this.selectedStartDate.getTime() - this.selectedEndDate.getTime()) /
          (1000 * 3600 * 24),
      );
      if (diffInDays > this.selectedDays) {
        this.selectedStartDate = null;
        this.selectedEndDate = null;
      }
    }
  }

  isRangeStart(date: Date): boolean {
    return this.isSameDate(date, this.selectedStartDate);
  }

  isRangeEnd(date: Date): boolean {
    return this.isSameDate(date, this.selectedEndDate);
  }

  applySelection(): void {
    this.applyDateRange();
  }
}
