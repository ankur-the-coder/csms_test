import { NgIf, NgClass, NgFor } from '@angular/common';
import { Component, Input, forwardRef, ElementRef, ViewChild, HostListener, Output, OnInit, OnDestroy, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor, FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [FormsModule, NgIf, NgClass, NgFor],
  templateUrl: './time-picker.html',
  styleUrl: './time-picker.css',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => TimePickerComponent),
    multi: true
  }]
})
export class TimePickerComponent implements ControlValueAccessor, OnInit, OnDestroy {
  readonly id = 'tp' + Math.random().toString(36).substring(2, 9);
  @Input() label: string = '';
  @Input() label2: string = '';
  @Input() placeHolder: string = 'Select time';
  @Input() readonly: boolean = false;
  @Input() disabled: boolean = false;
  @Output() onChangeInput: Subject<number> = new Subject<number>();
  @Output() change = new EventEmitter<number>();
  @Input() customClass: string = '';
  @Input() required: boolean = false;
  @Input() timeSelectionMode: 'both' | 'hours' | 'minutes' = 'both';

  hours: number = 0;
  minutes: number = 0;
  amPm: string = 'AM';
  dropdownOpen = false;
  displayValue = '';
  value: string | null = null;
  isDisabled: boolean = false;
  tempHours: number = 0;
  tempMinutes: number = 0;
  tempAmPm: string = 'AM';

  showHourView: boolean = true;
  hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  minuteNumbers = Array.from({ length: 60 }, (_, i) => i);
  Math = Math;

  showKeyboardInput: boolean = false;
  manualInputValue: string = '';
  timeDisplayInputValue: string = '';

  isDragging: boolean = false;
  clockRadius: number = 0;
  clockCenterX: number = 0;
  clockCenterY: number = 0;
  autoSwitchToMinutes: boolean = false;

  get displayHours(): number {
    const hoursToUse = this.showKeyboardInput ? this.hours : this.tempHours;
    if (hoursToUse === 0) return 12;
    if (hoursToUse > 12) return hoursToUse - 12;
    return hoursToUse;
  }

  onChange = (value: any) => {};
  onTouched = () => {};

  @ViewChild('dropdown') dropdown!: ElementRef;
  @ViewChild('clockFace') clockFace!: ElementRef;
  @ViewChild('dragHandle') dragHandle!: ElementRef;
  @ViewChild('timeInput') timeInput!: ElementRef;
  @ViewChild('hourInput') hourInput!: ElementRef;
  @ViewChild('minuteInput') minuteInput!: ElementRef;

  constructor(private eRef: ElementRef, private cdRef: ChangeDetectorRef) {}

  ngOnInit() {}

  ngOnDestroy(): void {
    const overlay = document.getElementById(this.id + '-overlay');
    if (overlay) overlay.remove();
  }

  private resetTempValues() {
    this.tempHours = this.hours;
    this.tempMinutes = this.minutes;
    this.tempAmPm = this.amPm;
  }

  ngAfterViewInit() {
    if (this.clockFace) {
      setTimeout(() => {
        const rect = this.clockFace.nativeElement.getBoundingClientRect();
        this.clockRadius = rect.width / 2;
        this.clockCenterX = rect.left + this.clockRadius;
        this.clockCenterY = rect.top + this.clockRadius;
      }, 0);
    }
  }

  updateHourValue(event: Event) {
    const input = event.target as HTMLInputElement;
    const numValue = parseInt(input.value, 10);
    if (numValue > 12) {
      input.value = '12';
      this.tempHours = 12;
    }
  }

  handledConditionFor0000hours(value: string): string {
    if (value == '12:00 AM') return '00:00';
    return value;
  }

  updateMinuteValue(event: Event) {
    const input = event.target as HTMLInputElement;
    const numValue = parseInt(input.value, 10);
    if (numValue >= 60) {
      input.value = '59';
      this.tempMinutes = 59;
    }
  }

  onMinuteBlur(input: HTMLInputElement) {
    const value = input.value;
    if (value === '' || isNaN(parseInt(value))) {
      input.value = '00';
      if (this.showKeyboardInput) this.tempMinutes = 0;
    } else {
      const num = Math.min(parseInt(value, 10), 59);
      input.value = num.toString().padStart(2, '0');
      if (this.showKeyboardInput) this.tempMinutes = num;
    }
  }

  onHourBlur(input: HTMLInputElement) {
    const value = input.value;
    if (value === '' || isNaN(parseInt(value))) {
      input.value = '12';
      if (this.showKeyboardInput) this.tempHours = this.tempAmPm === 'AM' ? 0 : 12;
    } else {
      const num = Math.min(Math.max(parseInt(value, 10), 1), 12);
      input.value = num.toString().padStart(2, '0');
      if (this.showKeyboardInput) {
        if (this.tempAmPm === 'PM' && num < 12) this.tempHours = num + 12;
        else if (this.tempAmPm === 'AM' && num === 12) this.tempHours = 0;
        else this.tempHours = num;
      }
    }
  }

  allowOnlyNumbers(event: KeyboardEvent) {
    if ([8, 9, 27, 13, 37, 38, 39, 40].indexOf(event.keyCode) !== -1) return;
    if ((event.shiftKey || (event.keyCode < 48 || event.keyCode > 57)) &&
      (event.keyCode < 96 || event.keyCode > 105)) {
      event.preventDefault();
    }
  }

  private formatDisplayValue() {
    let displayHours = this.hours;
    if (displayHours === 0) displayHours = 12;
    else if (displayHours > 12) displayHours = displayHours - 12;
    const formattedHours = displayHours.toString().padStart(2, '0');
    const formattedMinutes = this.minutes.toString().padStart(2, '0');
    this.displayValue = `${formattedHours}:${formattedMinutes} ${this.amPm}`;
    this.manualInputValue = this.displayValue;
    this.timeDisplayInputValue = this.displayValue;
  }

  writeValue(value: any): void {
    if (value !== undefined && value !== null) {
      this.hours = Math.floor(value / 60);
      this.minutes = value % 60;
    } else {
      const now = new Date();
      this.hours = now.getHours();
      this.minutes = now.getMinutes();
    }
    this.amPm = this.hours >= 12 ? 'PM' : 'AM';
    this.resetTempValues();
    this.formatDisplayValue();
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean) { this.disabled = isDisabled; }

  handleInputClick() {
    if (!this.showKeyboardInput) this.toggleDropdown();
  }

  toggleDropdown() {
    if (!this.readonly && !this.isDisabled) {
      this.dropdownOpen = !this.dropdownOpen;
      this.showHourView = true;
      this.showKeyboardInput = false;
      if (this.dropdownOpen) {
        this.resetTempValues();
        setTimeout(() => {
          if (this.clockFace) {
            const rect = this.clockFace.nativeElement.getBoundingClientRect();
            this.clockRadius = rect.width / 2;
            this.clockCenterX = rect.left + this.clockRadius;
            this.clockCenterY = rect.top + this.clockRadius;
          }
          const overlay = document.getElementById(this.id + '-overlay');
          if (overlay) {
            document.body.appendChild(overlay);
          }
        }, 10);
      } else {
        const overlay = document.getElementById(this.id + '-overlay');
        if (overlay) overlay.remove();
      }
    }
  }

  @HostListener('document:click', ['$event'])
  clickout(event: MouseEvent) {
    const overlay = document.getElementById(this.id + '-overlay');
    if (this.dropdownOpen && 
        !this.eRef.nativeElement.contains(event.target as Node) && 
        overlay && !overlay.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  closeDropdown() {
    const overlay = document.getElementById(this.id + '-overlay');
    if (overlay) {
      overlay.remove();
    }
    this.dropdownOpen = false;
    this.showKeyboardInput = false;
  }

  confirmSelection() {
    this.hours = this.tempHours;
    this.minutes = this.tempMinutes;
    this.amPm = this.tempAmPm;
    this.updateValue();
    this.closeDropdown();
  }

  switchToHourView() { this.showHourView = true; }

  switchToMinuteView() {
    if (this.timeSelectionMode !== 'hours') this.showHourView = false;
  }

  setAmPm(value: string) {
    if (this.tempAmPm !== value) {
      this.tempAmPm = value;
      if (value === 'AM' && this.tempHours >= 12) this.tempHours -= 12;
      else if (value === 'PM' && this.tempHours < 12) this.tempHours += 12;
    }
  }

  getSelectedHour(): number {
    const hours = this.showKeyboardInput ? this.hours : this.tempHours;
    if (hours === 0) return 12;
    return hours > 12 ? hours - 12 : hours;
  }

  getHourHandRotation(): number {
    let hour12 = this.showKeyboardInput ? this.getSelectedHour() :
      (this.tempHours === 0 ? 12 : (this.tempHours > 12 ? this.tempHours - 12 : this.tempHours));
    if (hour12 === 12) hour12 = 0;
    return (hour12 * 30) - 180;
  }

  getMinuteHandRotation(): number {
    return ((this.showKeyboardInput ? this.minutes : this.tempMinutes) * 6) - 180;
  }

  selectHour(hour: number) {
    if (this.tempAmPm === 'PM' && hour < 12) this.tempHours = hour + 12;
    else if (this.tempAmPm === 'AM' && hour === 12) this.tempHours = 0;
    else this.tempHours = hour;
    if (this.timeSelectionMode === 'both') this.switchToMinuteView();
  }

  selectMinute(minute: number) { this.tempMinutes = minute; }

  updateValue() {
    const totalMinutes = (this.hours * 60) + this.minutes;
    this.onChangeInput.next(totalMinutes);
    this.formatDisplayValue();
    this.onChange(totalMinutes);
    this.onTouched();
    this.change.emit(totalMinutes);
  }

  startDrag(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
    this.autoSwitchToMinutes = true;
    if (this.clockFace) {
      const rect = this.clockFace.nativeElement.getBoundingClientRect();
      this.clockRadius = rect.width / 2;
      this.clockCenterX = rect.left + this.clockRadius;
      this.clockCenterY = rect.top + this.clockRadius;
    }
    if (event instanceof MouseEvent) {
      this.updateHandPositionFromEvent(event.clientX, event.clientY);
    } else if (event instanceof TouchEvent && event.touches.length > 0) {
      this.updateHandPositionFromEvent(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (this.isDragging && event.touches.length > 0) {
      event.preventDefault();
      this.updateHandPositionFromEvent(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  @HostListener('document:touchend')
  onTouchEnd() {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.showHourView && this.autoSwitchToMinutes && this.timeSelectionMode === 'both') {
        this.switchToMinuteView();
        this.autoSwitchToMinutes = false;
      }
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onDrag(event: MouseEvent) {
    if (this.isDragging) {
      event.preventDefault();
      this.updateHandPositionFromEvent(event.clientX, event.clientY);
    }
  }

  @HostListener('document:mouseup')
  endDrag() {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.showHourView && this.autoSwitchToMinutes && this.timeSelectionMode === 'both') {
        this.switchToMinuteView();
        this.autoSwitchToMinutes = false;
      }
    }
  }

  updateHandPositionFromEvent(clientX: number, clientY: number) {
    if (!this.isDragging) return;
    const x = clientX - this.clockCenterX;
    const y = clientY - this.clockCenterY;
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    if (this.showHourView) {
      const hour = Math.round(angle / 30) % 12;
      if (hour === 0) {
        this.tempHours = this.tempAmPm === 'PM' ? 12 : 0;
      } else {
        this.tempHours = (this.tempAmPm === 'PM' && hour < 12) ? hour + 12 : hour;
      }
    } else {
      this.tempMinutes = Math.round(angle / 6) % 60;
    }
  }

  toggleKeyboardInput(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.showKeyboardInput = !this.showKeyboardInput;
    if (this.showKeyboardInput) {
      setTimeout(() => {
        if (this.hourInput) {
          const displayHour = this.tempHours === 0 ? 12 : (this.tempHours > 12 ? this.tempHours - 12 : this.tempHours);
          this.hourInput.nativeElement.value = displayHour.toString().padStart(2, '0');
        }
        if (this.minuteInput) {
          this.minuteInput.nativeElement.value = this.tempMinutes.toString().padStart(2, '0');
        }
      });
    }
  }

  applyManualInput() {
    const regex = /^(\d{1,2}):(\d{1,2})\s?(AM|PM)$/i;
    const timeValue = this.showKeyboardInput ? this.timeDisplayInputValue : this.manualInputValue;
    const match = timeValue.match(regex);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const period = match[3].toUpperCase();
      if (period === 'PM' && hours < 12) hours += 12;
      else if (period === 'AM' && hours === 12) hours = 0;
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        this.hours = hours;
        this.minutes = minutes;
        this.amPm = period;
        this.updateValue();
      }
    }
  }

  incrementTime(type: 'hour' | 'minute', event: Event) {
    (event as KeyboardEvent).preventDefault();
    if (type === 'hour') {
      let newHour: number;
      if (this.tempAmPm === 'AM') {
        if (this.tempHours === 11) { newHour = 12; this.tempAmPm = 'PM'; }
        else if (this.tempHours === 0) newHour = 1;
        else if (this.tempHours === 12) newHour = 13;
        else newHour = (this.tempHours + 1) % 24;
      } else {
        if (this.tempHours === 23) { newHour = 0; this.tempAmPm = 'AM'; }
        else newHour = (this.tempHours + 1) % 24;
      }
      this.tempHours = newHour;
      if (this.hourInput) {
        const d = this.tempHours === 0 ? 12 : (this.tempHours > 12 ? this.tempHours - 12 : this.tempHours);
        this.hourInput.nativeElement.value = d.toString().padStart(2, '0');
      }
    } else {
      this.tempMinutes = (this.tempMinutes + 1) % 60;
      if (this.minuteInput) this.minuteInput.nativeElement.value = this.tempMinutes.toString().padStart(2, '0');
    }
    this.cdRef.detectChanges();
  }

  decrementTime(type: 'hour' | 'minute', event: Event) {
    (event as KeyboardEvent).preventDefault();
    if (type === 'hour') {
      let newHour: number;
      if (this.tempAmPm === 'AM') {
        if (this.tempHours === 1) newHour = 0;
        else if (this.tempHours === 0) { newHour = 23; this.tempAmPm = 'PM'; }
        else newHour = this.tempHours - 1;
      } else {
        if (this.tempHours === 12) { newHour = 11; this.tempAmPm = 'AM'; }
        else if (this.tempHours === 13) newHour = 12;
        else newHour = this.tempHours - 1;
      }
      this.tempHours = newHour;
      if (this.hourInput) {
        const d = this.tempHours === 0 ? 12 : (this.tempHours > 12 ? this.tempHours - 12 : this.tempHours);
        this.hourInput.nativeElement.value = d.toString().padStart(2, '0');
      }
    } else {
      this.tempMinutes = (this.tempMinutes - 1 + 60) % 60;
      if (this.minuteInput) this.minuteInput.nativeElement.value = this.tempMinutes.toString().padStart(2, '0');
    }
    this.cdRef.detectChanges();
  }

  handleInputKeyDown(event: KeyboardEvent, type: 'hour' | 'minute') {
    if (['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    return this.allowOnlyNumbers(event);
  }
}
