
import { CommonModule, DatePipe, NgClass, NgFor } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnInit,
  Output,
  forwardRef,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { Subject } from 'rxjs';
import { DatePicker as DateService } from '../../../service/date-picker/date-picker';

@Component({
  selector: 'app-date-picker',
  templateUrl: './date-picker.html',
  imports: [NgClass, FormsModule, NgFor, CommonModule, DatePipe, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePicker),
      multi: true,
    },
  ]
})
export class DatePicker implements OnInit, ControlValueAccessor{
  @Input() label: string = '';
  @Input() addClass: string = '';
  @Input() disabled: boolean = false;
  @Input() showClearButton: boolean = false;
  @Input() placeHolder: string = 'Select Date';

  @Input() lastFiveDaysOnly: boolean = false;

  @Input() minDate?: Date | null = new Date(new Date().getFullYear() - 100, 0, 1); // Default to 20 years back from today
  @Input() maxDate?: Date | null = new Date(new Date().getFullYear() + 10, 11, 31); // Default to 10 years ahead from today
  @Output('onSelectDate') currentDate$: Subject<Date> = new Subject<Date>();
  @Output('onSelectFormattedDate') currentFormattedDate$: Subject<string> = new Subject<string>();
  @Input() required: boolean = false;
  @Input() navigationButtons: boolean = false;
  @Input() set forceClose(value: boolean) {
    if (value && this.isOpen) {
      this.isOpen = false;
      this.isYearDropdownOpen = false;
      this.isMonthDropdownOpen = false;
    }
  }
  @Input() useFixedPosition: boolean = false;
  dropdownStyles: { [key: string]: string } = {};
  isOpen = false;
  isYearDropdownOpen = false;
  isMonthDropdownOpen = false;
  currentDate: Date = new Date();
  selectedDate: Date | null = null;
  currentMonth: number = this.currentDate.getMonth();
  currentYear: number = this.currentDate.getFullYear();
  calendarDays: (number | null)[][] = [];
  daysOfWeek = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  months = [
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
  years: number[] = [];

  onChange = (value: string | null | Date) => { };
  onTouched = () => { };
  touched = false;


  constructor(private eRef: ElementRef) { }

  @HostListener('document:click', ['$event'])
  clickout(event: MouseEvent) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
      this.isYearDropdownOpen = false;
      this.isMonthDropdownOpen = false;
    }
  }

  clear() {
    this.writeValue('');
    this.onChange('');
    this.generateCalendar();
    this.isOpen = false;
    this.isYearDropdownOpen = false;
    this.isMonthDropdownOpen = false;
  }


  ngOnInit() {
    if (this.lastFiveDaysOnly) {
      const today = new Date();
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(today.getDate() - 4);

      // Set hours to 0 for accurate date comparison
      today.setHours(23, 59, 59, 999);
      fiveDaysAgo.setHours(0, 0, 0, 0);

      this.minDate = fiveDaysAgo;
      this.maxDate = today;
    }

    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
    this.generateYears();
    this.generateCalendar();
  }

  writeValue(value: Date | null | string): void {
    // If value is a string, try converting it to a Date
    if (typeof value === 'string') {
      const parsedDate = new Date(value);

      // Check if the date is valid
      if (isNaN(parsedDate.getTime())) {
        // console.error('Invalid date provided:', value);
        this.selectedDate = null; // Handle invalid date
        return;
      }

      value = parsedDate; // Valid date string, assign the parsed Date
    }

    if (value) {
      const hundredYearsAgo = new Date();
      hundredYearsAgo.setFullYear(hundredYearsAgo.getFullYear() - 100);

      if (value < hundredYearsAgo) {
        this.selectedDate = null;
        this.onChange(null);
        return;
      }
    }

    // If the date is null, handle it gracefully
    this.selectedDate = value;

    if (value) {
      this.currentMonth = value.getMonth();
      this.currentYear = value.getFullYear();
      this.generateCalendar();
    }
  }


  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggleDatepicker() {
    if (!this.disabled) {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.calculateDropdownPosition();
      } else {
        this.isYearDropdownOpen = false;
        this.isMonthDropdownOpen = false;
      }
      this.generateCalendar();
      this.markAsTouched();
    }
  }

  generateYears() {
    const currentYear = new Date().getFullYear();
    this.years = Array.from({ length: 100 }, (_, i) => currentYear - 90 + i);
  }

  // generateCalendar() {
  //   const firstDay = new Date(this.currentYear, this.currentMonth, 1);
  //   const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
  //   const daysInMonth = lastDay.getDate();
  //   let startingDay = firstDay.getDay() - 1; // Adjust for Monday start
  //   if (startingDay === -1) startingDay = 6; // Sunday becomes last day

  //   this.calendarDays = [];
  //   let week: (number | null)[] = Array(7).fill(null);
  //   let dayCounter = 1;

  //   for (let i = startingDay; i < 7; i++) {
  //     week[i] = dayCounter++;
  //   }
  //   this.calendarDays.push(week);

  //   while (dayCounter <= daysInMonth) {
  //     week = Array(7).fill(null);
  //     for (let i = 0; i < 7 && dayCounter <= daysInMonth; i++) {
  //       week[i] = dayCounter++;
  //     }
  //     this.calendarDays.push(week);
  //   }
  // }
  generateCalendar() {
    let firstDay = new Date(this.currentYear, this.currentMonth, 1);
    let lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    let daysInMonth = lastDay.getDate();
    let startingDay = firstDay.getDay() - 1; // Adjust for Monday start
    if (startingDay === -1) startingDay = 6; // Sunday becomes last day

    this.calendarDays = [];
    let week: (number | null)[] = Array(7).fill(null);
    let dayCounter = 1;
    let hasEnabledDates = false;

    for (let i = startingDay; i < 7; i++) {
      if (!this.isDateDisabled(dayCounter)) {
        hasEnabledDates = true;
      }
      week[i] = dayCounter++;
    }
    this.calendarDays.push(week);

    while (dayCounter <= daysInMonth) {
      week = Array(7).fill(null);
      for (let i = 0; i < 7 && dayCounter <= daysInMonth; i++) {
        if (!this.isDateDisabled(dayCounter)) {
          hasEnabledDates = true;
        }
        week[i] = dayCounter++;
      }
      this.calendarDays.push(week);
    }

    // If no enabled dates, move to the next available month

    if (!hasEnabledDates) {
      this.findNearestAvailableMonth();
    }
  }

  findNearestAvailableMonth() {
    let prevMonth = this.currentMonth;
    let prevYear = this.currentYear;
    let nextMonth = this.currentMonth;
    let nextYear = this.currentYear;
    let monthsChecked = 0; // Prevent infinite loop

    while (monthsChecked < 12) { // Check for 12 months in both directions
      // Check next month first
      nextMonth++;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
      }

      if (this.hasAvailableDates(nextYear, nextMonth)) {
        this.currentMonth = nextMonth;
        this.currentYear = nextYear;
        this.generateCalendar();
        return;
      }

      // Check previous month
      prevMonth--;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear--;
      }

      if (this.hasAvailableDates(prevYear, prevMonth)) {
        // console.log(prevMonth,prevYear)
        this.currentMonth = prevMonth;
        this.currentYear = prevYear;
        this.generateCalendar();
        return;
      }

      monthsChecked++;
    }

    // console.warn("No available dates found in the previous or next 12 months.");
  }

  // **Helper function to check if a month has enabled dates**
  hasAvailableDates(year: number, month: number): boolean {
    const lastDay = new Date(year, month + 1, 0).getDate(); // Get last day of the month
    for (let day = 1; day <= lastDay; day++) {
      if (!this.checkDateDisabled(year, month, day)) { // Pass year, month, and day to check if the date is available
        // console.log('Available date found:', new Date(year, month, day));
        return true;
      }
    }
    return false;
  }


  prevMonth() {
    if (this.isPrevMonthDisabled()) return; // Disable if out of range

    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.generateCalendar();
  }
  nextMonth() {
    if (this.isNextMonthDisabled()) return; // Disable if out of range

    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.generateCalendar();
  }

  selectDate(day: number | null) {
    if (day === null || this.disabled) return;

    const selectedDate = new Date(this.currentYear, this.currentMonth, day);
    // if (this.minDate?.getDate() && selectedDate.getDate() < this.minDate.getDate() || this.maxDate?.getDate() && selectedDate.getDate() > this.maxDate.getDate() && this.isYearDisabled(selectedDate.getFullYear()) && this.isMonthDisabled(selectedDate.getMonth())) {
    //   return; // Disable selection if out of range
    // }
    if (this.isDateDisabled(day)) return;
    this.selectedDate = selectedDate;
    this.onChange(DateService.format(this.selectedDate));
    this.currentDate$.next(this.selectedDate);
    this.currentFormattedDate$.next(DateService.format(this.selectedDate));
    this.markAsTouched();
    this.isOpen = false;
    this.isYearDropdownOpen = false;
    this.isMonthDropdownOpen = false;
  }

  toggleYearDropdown() {
    this.isYearDropdownOpen = !this.isYearDropdownOpen;
    this.isMonthDropdownOpen = false;
    if (this.isYearDropdownOpen) {
      setTimeout(() => {
        const dropdown = this.eRef.nativeElement.querySelector('.year-dropdown');
        const selected = dropdown?.querySelector('.bg-brand-500');
        if (selected && dropdown) {
          selected.scrollIntoView({ block: 'center' });
        }
      }, 0);
    }
  }

  toggleMonthDropdown() {
    this.isMonthDropdownOpen = !this.isMonthDropdownOpen;
    this.isYearDropdownOpen = false;
    if (this.isMonthDropdownOpen) {
      setTimeout(() => {
        const dropdown = this.eRef.nativeElement.querySelector('.month-dropdown');
        const selected = dropdown?.querySelector('.bg-brand-500');
        if (selected && dropdown) {
          selected.scrollIntoView({ block: 'center' });
        }
      }, 0);
    }
  }

  isSelected(day: number | null): boolean {
    if (!this.selectedDate || day === null) return false;
    return (
      this.selectedDate.getDate() === day &&
      this.selectedDate.getMonth() === this.currentMonth &&
      this.selectedDate.getFullYear() === this.currentYear
    );
  }

  isToday(day: number | null): boolean {
    if (day === null) return false;
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === this.currentMonth &&
      today.getFullYear() === this.currentYear
    );
  }

  isPrevMonthDisabled(): boolean {
    if (!this.minDate) return false;
    const firstOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    return firstOfMonth <= this.minDate;
  }

  // Helper to check if the next month is disabled
  isNextMonthDisabled(): boolean {
    if (!this.maxDate) return false;
    const lastOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);
    return lastOfMonth >= this.maxDate;
  }



  isMonthDisabled(monthIndex: number): boolean {
    const isBeforeMinDate =
      this.minDate &&
      this.currentYear === this.minDate.getFullYear() &&
      monthIndex < this.minDate.getMonth();
    const isAfterMaxDate =
      this.maxDate &&
      this.currentYear === this.maxDate.getFullYear() &&
      monthIndex > this.maxDate.getMonth();
    return !!isBeforeMinDate || !!isAfterMaxDate;
  }

  isYearDisabled(year: number): boolean {
    const isBeforeMinDate = this.minDate && year < this.minDate.getFullYear();
    const isAfterMaxDate = this.maxDate && year > this.maxDate.getFullYear();
    return !!isBeforeMinDate || !!isAfterMaxDate;
  }

  checkDateDisabled(year: number, month: number, day: number | null): boolean {
    if (day === null) return true; // Invalid day
    const date = new Date(year, month, day); // Use full date for the comparison

    // Check min/max date restrictions
    if (this.minDate && date < this.minDate) return true;
    if (this.maxDate && date > this.maxDate) return true;

    return false; // Apply other disabling conditions here
  }
  isDateDisabled(day: number | null): boolean {
    if (day === null) return true;

    const date = new Date(this.currentYear, this.currentMonth, day);

    // Separate checks for year, month, and day

    // Year check
    if (this.minDate && date.getFullYear() < this.minDate.getFullYear()) {
      return true;
    }
    if (this.maxDate && date.getFullYear() > this.maxDate.getFullYear()) {
      return true;
    }

    // Month check (only if within the same year as minDate or maxDate)
    if (this.minDate && date.getFullYear() === this.minDate.getFullYear() && date.getMonth() < this.minDate.getMonth()) {
      return true;
    }
    if (this.maxDate && date.getFullYear() === this.maxDate.getFullYear() && date.getMonth() > this.maxDate.getMonth()) {
      return true;
    }

    // Day check (only if within the same year and month as minDate or maxDate)
    if (this.minDate && date.getFullYear() === this.minDate.getFullYear() && date.getMonth() === this.minDate.getMonth() && date.getDate() < this.minDate.getDate()) {
      return true;
    }
    if (this.maxDate && date.getFullYear() === this.maxDate.getFullYear() && date.getMonth() === this.maxDate.getMonth() && date.getDate() > this.maxDate.getDate()) {
      return true;
    }

    // If all checks pass, the date is within the allowed range
    return false;
  }


  // Update the calendar generation to reflect current year and month

  markAsTouched() {
    if (!this.touched) {
      this.onTouched();
      this.touched = true;
    }
  }


  navigateDate(direction: 'forward' | 'back') {
    if (this.disabled) return;

    if (!this.selectedDate) {
      // If no date is selected, use current date
      this.selectedDate = new Date();
    }

    const currentDate = new Date(this.selectedDate);

    if (direction === 'forward') {
      // Navigate forward by one day
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 1);

      // Check if the new date exceeds maxDate
      if (this.maxDate && newDate > this.maxDate) return;

      this.selectedDate = newDate;
    } else {
      // Navigate backward by one day
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() - 1);

      // Check if the new date is before minDate
      if (this.minDate && newDate < this.minDate) return;

      this.selectedDate = newDate;
    }

    // Update month and year if the navigation changes them
    this.currentMonth = this.selectedDate.getMonth();
    this.currentYear = this.selectedDate.getFullYear();

    // Generate calendar for the new month/year
    this.generateCalendar();

    // Update the form control value
    this.onChange(DateService.format(this.selectedDate));
    this.currentDate$.next(this.selectedDate);
    this.currentFormattedDate$.next(DateService.format(this.selectedDate));
    this.markAsTouched();
  }

  canNavigateBack(): boolean {
    if (!this.selectedDate || !this.minDate) return true;

    // Create a new date that's one day before the currently selected date
    const prevDate = new Date(this.selectedDate);
    prevDate.setDate(prevDate.getDate() - 1);

    // Check if the previous date would be before minDate
    return prevDate >= this.minDate;
  }

  canNavigateForward(): boolean {
    if (!this.selectedDate || !this.maxDate) return true;

    // Create a new date that's one day after the currently selected date
    const nextDate = new Date(this.selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Check if the next date would be after maxDate
    return nextDate <= this.maxDate;
  }


  // Add these properties after your existing properties
  dropdownPosition: 'bottom' | 'top' | 'left' | 'right' = 'bottom';

  // Add this method
  // calculateDropdownPosition() {
  //   const element = this.eRef.nativeElement.querySelector('.custom-select-container');
  //   if (!element) return;

  //   const rect = element.getBoundingClientRect();
  //   const dropdownHeight = 300; // Approximate height of your dropdown
  //   const dropdownWidth = 250; // Your dropdown width
  //   const padding = 10; // Safety padding

  //   const spaceBelow = window.innerHeight - rect.bottom;
  //   const spaceAbove = rect.top;
  //   const spaceRight = window.innerWidth - rect.right;
  //   const spaceLeft = rect.left;

  //   // Prioritize: bottom > top > right > left
  //   if (spaceBelow >= dropdownHeight + padding) {
  //     this.dropdownPosition = 'bottom';
  //   } else if (spaceAbove >= dropdownHeight + padding) {
  //     this.dropdownPosition = 'top';
  //   } else if (spaceRight >= dropdownWidth + padding) {
  //     this.dropdownPosition = 'right';
  //   } else if (spaceLeft >= dropdownWidth + padding) {
  //     this.dropdownPosition = 'left';
  //   } else {
  //     // Default to bottom if no good option
  //     this.dropdownPosition = 'bottom';
  //   }
  // }
  calculateDropdownPosition() {
    const element = this.eRef.nativeElement.querySelector('.custom-select-container');
    if (!element) return;

    if (this.useFixedPosition) {
      const trigger = this.eRef.nativeElement.querySelector('input')
        || this.eRef.nativeElement.querySelector('[class*="py-2"]');
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const calendarHeight = 280;
      const calendarWidth = 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const topPos = spaceBelow >= calendarHeight || spaceBelow >= spaceAbove
        ? rect.bottom + 4
        : rect.top - calendarHeight - 4;

      let leftPos = rect.left;
      if (leftPos + calendarWidth > window.innerWidth) {
        leftPos = window.innerWidth - calendarWidth - 8;
      }

      this.dropdownStyles = {
        top: `${topPos}px`,
        left: `${leftPos}px`,
      };

    } else {
      // Original logic — untouched
      const rect = element.getBoundingClientRect();
      const dropdownHeight = 280; // Approximate height of your dropdown
      const dropdownWidth = 220; // Your dropdown width
      const padding = 10; // Safety padding

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;

      // Prioritize: bottom > top > right > left
      if (spaceBelow >= dropdownHeight + padding) {
        this.dropdownPosition = 'bottom';
      } else if (spaceAbove >= dropdownHeight + padding) {
        this.dropdownPosition = 'top';
      } else if (spaceRight >= dropdownWidth + padding) {
        this.dropdownPosition = 'right';
      } else if (spaceLeft >= dropdownWidth + padding) {
        this.dropdownPosition = 'left';
      } else {
        // Default to bottom if no good option
        this.dropdownPosition = 'bottom';
      }
    }
  }
  // add new host listeners to close the dropdown on scroll/resize when using fixed positioning
  // REPLACE your existing onWindowScroll
  @HostListener('window:scroll')
  onWindowScroll() {
    if (this.isOpen && this.useFixedPosition) {
      this.isOpen = false;
      this.isYearDropdownOpen = false;
      this.isMonthDropdownOpen = false;
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.isOpen && this.useFixedPosition) {
      this.isOpen = false;
      this.isYearDropdownOpen = false;
      this.isMonthDropdownOpen = false;
    }
  }

  @HostListener('document:scroll', ['$event'])
  onDocumentScroll(event: Event) {
    if (this.isOpen && this.useFixedPosition) {
      this.isOpen = false;
      this.isYearDropdownOpen = false;
      this.isMonthDropdownOpen = false;
    }

  }
}
