import { CommonModule, DatePipe, NgClass, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  Output,
  SimpleChanges,
  ViewChild,
  OnInit,
  AfterContentInit,
  OnDestroy,
  OnChanges,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';


@Component({
  selector: 'app-custom-date-selector',
  imports: [ CommonModule,
    FormsModule,
    NgClass,],
  templateUrl: './custom-date-selector.html',
  styleUrl: './custom-date-selector.css',
})
export class CustomDateSelector implements OnInit, AfterContentInit, OnDestroy, OnChanges{
   readonly id = 'cds' + Math.random().toString(36).substring(2, 9);
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
  @Output() onApplyDate = new Subject<{ from: string; to: string }>();

  @ViewChild('yearDropdown') yearDropdownElement!: ElementRef;
  @ViewChild('monthDropdown') monthDropdownElement!: ElementRef;

  datePickerPosition: string = '';
  showDatePicker = false;
  currentMonth: Date = new Date();
  selectedStartDate: Date | null = null;
  selectedEndDate: Date | null = null;
  submittedStartDate: Date | null = null;
  submittedEndDate: Date | null = null;

  days: string[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
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
    { key: 'lastMonth', label: 'Last 30 Days' },
    { key: 'currentMonth', label: 'Current Month' },
    { key: 'last90days', label: 'Last 90 Days' },
    { key: 'custom', label: 'Custom Date' }
  ];

  private dateRangeYears: number = 10;
  private currentDate: Date = new Date();

  disabled: boolean = false;
  hoveredDate: Date | null = null;

  months: string[] = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  showMonthDropdown: boolean = false;
  showYearDropdown: boolean = false;
  yearRange: number[] = [];
  closing: boolean = false;
  isSelectingRange: boolean = false;

  // SSR-safety helpers
  private isBrowser: boolean;

  constructor(
    private elementRef: ElementRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document,
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
        this.selectPreset('today');
      }
      this.submittedStartDate = this.selectedStartDate;
      this.submittedEndDate = this.selectedEndDate;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialDates']) {
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
        this.currentMonth = new Date(this.selectedStartDate.getFullYear(), this.selectedStartDate.getMonth(), 1);
      }

      this.renderCalendar(this.currentMonth);
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      const overlay = this.document.getElementById(this.id + '-overlay');
      if (overlay) overlay.remove();
    }
    this.onApplyDate.complete();
  }

  private updateSelectedPreset(): void {
    if (!this.selectedStartDate || !this.selectedEndDate) return;

    const diffTime = this.selectedEndDate.getTime() - this.selectedStartDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;

    const firstDayOfCurrentMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
    const lastDayOfCurrentMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);

    const isFirstDayOfCurrentMonth = this.selectedStartDate.getDate() === 1;
    const isEndDateBeforeOrEqualLastDayOfCurrentMonth = this.selectedEndDate <= lastDayOfCurrentMonth;

    if (isFirstDayOfCurrentMonth && isEndDateBeforeOrEqualLastDayOfCurrentMonth && diffDays > 1 && diffDays !== 7) {
      this.selectedPreset = "currentMonth";
    } else if (diffDays >= 28 && diffDays <= 31) {
      this.selectedPreset = "currentMonth";
    } else if (diffDays === 7) {
      this.selectedPreset = "lastWeek";
    } else if (diffDays <= 1) {
      this.selectedPreset = "today";
    } else {
      this.selectedPreset = "custom";
    }
  }

  toggleDatePicker(event?: MouseEvent): void {
    if (!this.toggle) return;

    if (!this.showDatePicker) {
      this.currentMonth = new Date(
        (this.selectedEndDate || this.currentDate).getFullYear(),
        (this.selectedEndDate || this.currentDate).getMonth(),
        1
      );
      this.renderCalendar(this.currentMonth);
      this.showDatePicker = true;
      this.isSelectingRange = false;

      if (event) {
        this.calculatePosition(event);
      }

      if (this.isBrowser) {
        setTimeout(() => {
          const overlay = this.document.getElementById(this.id + '-overlay');
          if (overlay) {
            this.document.body.appendChild(overlay);
          }
        }, 10);
      }
    } else {
      this.closeDatePicker();
    }
  }

  private calculatePosition(event: MouseEvent): void {
    if (!this.isBrowser) return;

    const buttonElement = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const pickerWidth = 460; // Approximate modal width

    if (buttonElement.right + pickerWidth > viewportWidth) {
      this.datePickerPosition = 'sm:right-0 sm:left-auto';
    } else {
      this.datePickerPosition = 'sm:left-0 sm:right-auto';
    }
  }
  clearDates(): void {
    this.selectedStartDate = null;
    this.selectedEndDate = null;
    this.submittedStartDate = null;
    this.submittedEndDate = null;
    this.selectedPreset = null;
    this.previousPreset = null;
    this.onApplyDate.next({ from: '', to: '' });
    this.closeDatePicker();
  }
  closeDatePicker(): void {
    if (this.isBrowser) {
      const overlay = this.document.getElementById(this.id + '-overlay');
      if (overlay) overlay.remove();
    }
    this.showDatePicker = false;
    this.showMonthDropdown = false;
    this.showYearDropdown = false;
    this.isSelectingRange = false;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.isBrowser) return;

    const overlay = this.document.getElementById(this.id + '-overlay');
    if (!this.elementRef.nativeElement.contains(event.target as Node) &&
      overlay && !overlay.contains(event.target as Node)) {
      if (this.showDatePicker) {
        this.closeDatePicker();
      }
    }
  }

  get minDate(): Date {
    if (this.setMinDate) return this.setMinDate;
    const minDate = new Date(this.currentDate);
    minDate.setFullYear(minDate.getFullYear() - this.dateRangeYears);
    return minDate;
  }

  get maxDate(): Date {
    if (this.setMaxDate) return this.setMaxDate;
    const maxDate = new Date(this.currentDate);
    maxDate.setFullYear(maxDate.getFullYear() + this.dateRangeYears);
    return maxDate;
  }

  renderCalendar(date: Date): void {
    this.firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    this.emptyDays = Array(this.firstDayOfMonth).fill(0);

    const lastDateOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    this.monthDates = [];
    for (let i = 1; i <= lastDateOfMonth; i++) {
      this.monthDates.push(new Date(date.getFullYear(), date.getMonth(), i));
    }

    // Fill the rest of the 42 cells (6 rows) to keep height consistent
    const totalCells = 42;
    const filledCells = this.emptyDays.length + this.monthDates.length;
    this.trailingDays = Array(totalCells - filledCells).fill(0);
  }

  prevMonth(): void {
    const newMonth = new Date(this.currentMonth);
    newMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.currentMonth = newMonth;
    this.renderCalendar(this.currentMonth);
  }

  nextMonth(): void {
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

  selectDateRange(rangeType: string): void {
    this.selectedPreset = rangeType;
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
    const month = date.toLocaleString('en-us', { month: 'short' });
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
    return date && !isNaN(date.getTime()) ? date.toLocaleString('default', { month: 'long' }) : 'Invalid month';
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
        const selectedMonthElement = this.monthDropdownElement.nativeElement.querySelector('.bg-brand-100');
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
        const selectedYearElement = this.yearDropdownElement.nativeElement.querySelector('.bg-brand-100');
        if (selectedYearElement) {
          selectedYearElement.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      }, 0);
    }
  }

  selectMonth(monthIndex: number) {
    const newDate = new Date(this.currentMonth);
    newDate.setMonth(monthIndex);
    this.currentMonth = newDate;
    this.renderCalendar(this.currentMonth);
    this.showMonthDropdown = false;
  }

  selectYear(year: number) {
    const newDate = new Date(this.currentMonth);
    newDate.setFullYear(year);
    this.currentMonth = newDate;
    this.renderCalendar(this.currentMonth);
    this.showYearDropdown = false;
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

  private formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  canShiftDate(direction: number): boolean {
    if (!this.selectedStartDate || !this.selectedEndDate) return false;

    const newStartDate = this.addDays(this.selectedStartDate, direction);
    const newEndDate = this.addDays(this.selectedEndDate, direction);

    return (
      newStartDate >= this.normalizeDate(this.minDate) &&
      newEndDate <= this.normalizeDate(this.maxDate)
    );
  }

  shiftDateRange(direction: number, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.selectedStartDate || !this.selectedEndDate) return;

    const today = this.normalizeDate(new Date());

    switch (this.selectedPreset) {
      case 'today':
      case 'yesterday':
        this.selectedStartDate = this.addDays(this.selectedStartDate, direction);
        this.selectedEndDate = this.addDays(this.selectedEndDate, direction);
        break;

      case 'lastWeek':
        this.selectedStartDate = this.addDays(this.selectedStartDate, 7 * direction);
        this.selectedEndDate = this.addDays(this.selectedEndDate, 7 * direction);
        break;

      case 'lastMonth':
      case 'currentMonth':
        const currentStart = this.selectedStartDate;
        const newMonth = currentStart.getMonth() + direction;
        const newYear = currentStart.getFullYear() + Math.floor(newMonth / 12);
        const adjustedMonth = ((newMonth % 12) + 12) % 12;

        this.selectedStartDate = new Date(newYear, adjustedMonth, 1, 12, 0, 0, 0);
        const lastDay = new Date(newYear, adjustedMonth + 1, 0).getDate();
        this.selectedEndDate = new Date(newYear, adjustedMonth, lastDay, 12, 0, 0, 0);

        if (this.setMaxDate) {
          const normalizedMax = this.normalizeDate(this.setMaxDate);
          if (this.selectedEndDate > normalizedMax) this.selectedEndDate = normalizedMax;
        }
        break;

      case 'last90days':
        this.selectedStartDate = this.addDays(this.selectedStartDate, 90 * direction);
        this.selectedEndDate = this.addDays(this.selectedEndDate, 90 * direction);
        break;

      case 'custom':
        const diffInDays = Math.round((this.selectedEndDate.getTime() - this.selectedStartDate.getTime()) / (1000 * 60 * 60 * 24));
        this.selectedStartDate = this.addDays(this.selectedStartDate, direction * (diffInDays + 1));
        this.selectedEndDate = this.addDays(this.selectedEndDate, direction * (diffInDays + 1));
        break;

      default: return;
    }

    this.currentMonth = new Date(this.selectedStartDate.getFullYear(), this.selectedStartDate.getMonth(), 1);
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
      this.onApplyDate.next({
        from: this.formatDateToString(this.selectedStartDate),
        to: this.formatDateToString(this.selectedEndDate),
      });
    }

    this.closeDatePicker();
  }

  selectPreset(preset: string): void {
    const today = this.normalizeDate(new Date());
    let startDate: Date;
    let endDate: Date;

    if (this.selectedPreset && !this.previousPreset) {
      this.previousPreset = this.selectedPreset;
    }
    this.selectedPreset = preset;
    this.isSelectingRange = false;

    switch (preset) {
      case 'today':
        startDate = endDate = today;
        break;
      case 'yesterday':
        startDate = endDate = this.addDays(today, -1);
        break;
      case 'lastWeek':
        const currentDay = today.getDay();
        const daysSinceLastMonday = (currentDay + 6) % 7;
        startDate = this.addDays(today, -(daysSinceLastMonday + 7));
        endDate = this.addDays(startDate, 6);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12, 0, 0, 0);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0, 12, 0, 0, 0);
        break;
      case 'currentMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        endDate = new Date(today.getFullYear(), today.getMonth(), lastDay, 12, 0, 0, 0);
        break;
      case 'last90days':
        startDate = this.addDays(today, -90);
        endDate = today;
        break;
      default: return;
    }

    this.selectedStartDate = startDate;
    this.selectedEndDate = endDate;
    this.currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    this.renderCalendar(this.currentMonth);
  }

  selectDate(date: Date): void {
    if (!this.previousPreset) this.previousPreset = this.selectedPreset;

    const normalizedDate = this.normalizeDate(date);
    const normalizedMin = this.minDate ? this.normalizeDate(this.minDate) : null;
    const normalizedMax = this.maxDate ? this.normalizeDate(this.maxDate) : null;

    if ((normalizedMin && normalizedDate < normalizedMin) || (normalizedMax && normalizedDate > normalizedMax)) return;

    this.selectedPreset = 'custom';

    if (!this.isSelectingRange) {
      this.selectedStartDate = normalizedDate;
      this.selectedEndDate = normalizedDate;
      this.isSelectingRange = true;
    } else {
      if (this.selectedStartDate && normalizedDate < this.selectedStartDate) {
        // Reset start date if user clicks an earlier date
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
      const diffInDays = Math.ceil(Math.abs(this.selectedStartDate.getTime() - this.selectedEndDate.getTime()) / (1000 * 3600 * 24));
      if (diffInDays > this.selectedDays) {
        this.selectedStartDate = null;
        this.selectedEndDate = null;
        // this.toastr.error(`Max range is ${this.selectedDays} days.`);
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
