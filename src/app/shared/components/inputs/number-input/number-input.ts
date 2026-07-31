import {
  Component,
  ElementRef,
  forwardRef,
  input,
  model,
  output,
  signal,
  viewChild,
  inject,
  ChangeDetectionStrategy,
  computed,
  ChangeDetectorRef,
} from '@angular/core';

import { NgClass } from '@angular/common';
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
// Lucide icons removed; using inline SVGs in template instead

@Component({
  selector: 'app-number-input',
  standalone: true,
  imports: [NgClass],
  templateUrl: './number-input.html',
  styleUrls: ['./number-input.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NumberInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NumberInputComponent),
      multi: true,
    },
  ],
})
export class NumberInputComponent implements ControlValueAccessor, Validator {
  // ───────── INPUTS ─────────
  label = input<string>('');
  placeholder = input<string>('');
  addClass = input<string>('');
  suffix = input<string>('');
  readOnly = input<boolean>(false);
  disabled = input<boolean>(false);
  required = input<boolean>(false);
  roundOff = input<boolean>(false);

  min = input<number | null | undefined>(null);
  max = input<number | null | undefined>(null);
  maxLength = input<number | null | undefined>(null);
  step = input<number>(1);
  showStep = input<boolean>(false);
  hasCustomError = input<boolean>(false);

  // ───────── MODEL ─────────
  value = model<number | null>(null);

  // ───────── OUTPUTS ─────────
  //valueChange = output<number | null>();
  inputEvent = output<Event>();

  // ───────── STATE ─────────
  readonly isTouched = signal(false);
  readonly isDisabled = signal(false);
  readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputRef');

  private _onChange = (_: number | null) => {};
  private _onTouched = () => {};

  private readonly cdr = inject(ChangeDetectorRef);
  private _control: FormControl | null = null;

  // ───────── CONTROL AUTO DETECT ─────────
  get control(): FormControl | null {
    return this._control;
  }

  get isEffectivelyDisabled(): boolean {
    return this.disabled() || this.isDisabled();
  }

  get isRequired(): boolean {
    return this.required();
  }

  isError(): boolean {
    const ctrl = this.control;
    return !!(ctrl?.invalid && (ctrl?.touched || this.isTouched()));
  }

  inputClasses(): string {
    const base = [
      'w-full px-3 py-2 text-sm rounded-lg border border-card-border text-text-secondary',
      'bg-card-bg outline-none transition-all duration-200',
    ];

    if (this.showStep()) {
      base.push('pr-8');
    } else if (this.suffix()) {
      base.push('pr-7');
    } else {
      base.push('pr-3');
    }

    if (this.isError() || this.hasCustomError()) {
      base.push('border-red-500 bg-red-50/30');
    }

    if (this.isEffectivelyDisabled) {
      base.push('cursor-not-allowed opacity-60 border');
    }

    return base.join(' ');
  }

  increment(): void {
    if (this.isEffectivelyDisabled || this.readOnly()) return;
    const current = this.value() ?? 0;
    const stepVal = this.step() || 1;
    const next = current + stepVal;
    this.updateValue(next, new Event('input'));
    this.markTouched();
  }

  decrement(): void {
    if (this.isEffectivelyDisabled || this.readOnly()) return;
    const current = this.value() ?? 0;
    const stepVal = this.step() || 1;
    let next = current - stepVal;
    if (next <= 0) next = 0;
    this.updateValue(next, new Event('input'));
    this.markTouched();
  }

  // ───────── CVA ─────────
  writeValue(val: number | null): void {
    this.value.set(val);
  }

  registerOnChange(fn: typeof this._onChange): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: typeof this._onTouched): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this._control) {
      this._control = control as FormControl;
    }
    this.cdr.markForCheck();
    const value = control.value;

    if (this.required() && (value === null || value === undefined || value === '')) {
      return { required: true };
    }

    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (this.min() != null && value < this.min()!) {
      return { min: { min: this.min(), actual: value } };
    }

    if (this.max() != null && value > this.max()!) {
      return { max: { max: this.max(), actual: value } };
    }

    return null;
  }

// ───────── EVENTS ─────────
onInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  let raw = input.value;

  // Remove invalid characters
  raw = raw.replace(/[-+]/g, '');

  // Apply maxLength if configured
  raw = this.applyMaxLength(raw);

  let parsed = raw === '' ? null : Number(raw);

  // Round off only when enabled
  if (this.roundOff() && parsed !== null && !isNaN(parsed)) {
    parsed = Math.round(parsed);
    raw = parsed.toString();
  }

  // Update input value if it was modified
  if (input.value !== raw) {
    input.value = raw;
  }

  this.updateValue(parsed, event);
}

onKeyDown(event: KeyboardEvent): void {
  const blockedKeys = ['-', '+'];

  if (blockedKeys.includes(event.key)) {
    event.preventDefault();
  }
}

onBlur(): void {
  this.markTouched();
}

disableScroll(event: WheelEvent): void {
  event.preventDefault();
  (event.target as HTMLInputElement).blur();
}


  // ───────── HELPERS ─────────
  private updateValue(value: number | null, event: Event) {
    this.value.set(value);
    this._onChange(value);
    //this.valueChange.emit(value);
    this.inputEvent.emit(event);
  }

  private applyMaxLength(value: string): string {
    const maxLen = this.maxLength();
    if (!maxLen) return value;
    const isNegative = value.startsWith('-');
    const digitsOnly = value.replace('-', '');
    if (digitsOnly.length <= maxLen) return value;
    const trimmed = digitsOnly.slice(0, maxLen);
    return isNegative ? '-' + trimmed : trimmed;
  }

  private markTouched(): void {
    if (!this.isTouched()) {
      this.isTouched.set(true);
      this._onTouched();
    }
  }
}
