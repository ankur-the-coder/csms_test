import {
  ChangeDetectorRef,
  Component,
  OnInit,
  computed,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { NgClass } from '@angular/common';

// ───────────────── TYPES ─────────────────
export type InputMode = 'text' | 'name' | 'email' | 'phone' | 'password';
export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'outlined' | 'filled' | 'underline' | 'ghost';

// ───────────────── VALIDATORS ────────────
const ValidatorsMap: Record<InputMode, ValidatorFn | null> = {
  text: (c) => {
    const val = c.value;
    if (!val) return null;
    if (/^\s/.test(val)) return { leadingSpace: true };
    if (/\s{2,}/.test(val)) return { doubleSpace: true };
    if (/[.]/.test(val)) return { noDots: true };
    return null;
  },
  password: null,
  email: (c) => {
    const val = c.value;
    if (!val) return null;

    if (!val.includes('@')) return { emailNoAt: true };
    const parts = val.split('@');
    if (parts.length > 2) return { emailMultiAt: true };
    if (!parts[1] || !parts[1].includes('.')) return { emailNoDot: true };

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return !emailRegex.test(val) ? { emailInvalid: true } : null;
  },

  name: (c) => {
    const val = c.value;
    if (!val) return null;
    if (/^\s/.test(val)) return { leadingSpace: true };
    if (/\s{2,}/.test(val)) return { doubleSpace: true };
    if (!/^[a-zA-Z\s\-'.]+$/.test(val)) return { onlyLetters: true };
    return null;
  },

  phone: (c) => {
    const val = c.value;
    if (!val) return null;

    if (!/^\d{10}$/.test(val))
      return { phoneFormat: true };

    if (!/^[6-9]/.test(val))
      return { phoneStart: true };

    if (/^(\d)\1{9}$/.test(val))
      return { sameDigits: true };

    return null;
  }
};

// ───────────────── COMPONENT ─────────────
@Component({
  selector: 'app-text-input',
  standalone: true,
  imports: [NgClass, ReactiveFormsModule],
  templateUrl: './text-input.html',
  styleUrl: './text-input.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true,
    },
  ],
})
export class
  TextInputComponent
  implements ControlValueAccessor, Validator, OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private _control: AbstractControl | null = null;

  // ───────────── INPUTS (Public API) ─────────────
  readonly label = input('');
  readonly placeholder = input('');
  readonly type = input<InputMode>('text');
  readonly size = input<InputSize>('md');
  readonly variant = input<InputVariant>('outlined');
  readonly maxLength = input<number>(100);
  readonly disabled = input(false);
  readonly readOnly = input(false);
  readonly required = input(false);


  // ───────────── MODEL ─────────────
  readonly searchValue = model('');

  // ───────────── OUTPUTS ───────────
  readonly valueChange = output<string>();
  readonly inputBlur = output<FocusEvent>();
  readonly inputFocus = output<FocusEvent>();

  // ───────────── STATE ─────────────
  readonly value = signal('');
  readonly isFocused = signal(false);
  readonly showPassword = signal(false);
  readonly touched = signal(false);

  readonly id = `txt_${Math.random().toString(36).slice(2, 9)}`;

  get control(): FormControl | null {
    return this._control as FormControl | null;
  }

  get isRequired(): boolean {
    return this.required();
  }

  // ───────────── COMPUTED ──────────
  readonly inputType = computed(() => {
    if (this.type() === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    return this.type();
  });

  readonly isError = computed(() => {
    this.value();
    return !!(
      this.control?.invalid &&
      (this.control?.touched || this.touched())
    );
  });

  readonly errorMessages = computed(() => {
    this.value();

    if (!this.isError()) return [];

    const errors = this.control?.errors;
    if (!errors) return [];

    const label = this.label() || 'Field';

    const errorMap: Record<string, (l: string) => string> = {
      required: (l) => `${l} is required`,
      emailNoAt: () => `Email must contain an '@' symbol`,
      emailMultiAt: () => `Email cannot have multiple '@' symbols`,
      emailNoDot: () => `Email must have a domain (e.g., .com)`,
      emailInvalid: () => `Please enter a valid email address`,
      onlyLetters: (l) => `${l} can only contain letters`,
      phoneFormat: (l) => `${l} must be a 10-digit number`,
      phoneStart: (l) => `${l} must start with 6, 7, 8, or 9`,
      sameDigits: (l) => `${l} cannot have all identical digits`,
      maxlength: (l) => `${l} is too long`,
      leadingSpace: (l) => `${l} cannot start with a space`,
      doubleSpace: (l) => `${l} cannot have consecutive spaces`,
      noDots: (l) => `${l} cannot contain dots (.)`,
    };

    return Object.keys(errors)
      .map((key) => errorMap[key]?.(label))
      .filter(Boolean)
      .slice(0, 1);
  });

  readonly inputClasses = computed(() => {
    const base = [
      'w-full rounded-lg border px-3 py-2 text-sm text-text-secondary',
      'transition-all duration-200 outline-none focus:ring-0',
    ];

    if (this.isError()) base.push('border-red-500 bg-red-50/30');
    else base.push('border border-card-border');

    if (this.disabled()) {
      base.push('cursor-not-allowed opacity-60');
    }

    return base.join(' ');
  });

  ngOnInit() { }

  // ───────────── CVA ─────────────
  private _onChange = (_: any) => { };
  private _onTouched = () => { };

  writeValue(val: any) {
    this.value.set(val ?? '');
    this.cdr.detectChanges();
  }

  registerOnChange(fn: any) {
    this._onChange = fn;
  }

  registerOnTouched(fn: any) {
    this._onTouched = fn;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this._control) this._control = control;

    const errors: ValidationErrors = {};
    let hasError = false;

    if (this.required() && !control.value) {
      errors['required'] = true;
      hasError = true;
    }

    const validator = ValidatorsMap[this.type()];
    if (validator) {
      const result = validator(control);
      if (result) {
        Object.assign(errors, result);
        hasError = true;
      }
    }

    if (this.maxLength() && control.value?.length > this.maxLength()) {
      errors['maxlength'] = true;
      hasError = true;
    }

    return hasError ? errors : null;
  }

  // ───────────── EVENTS ───────────
  onInput(event: Event) {
    const inputValue = this.getInputValue(event);
    const formatted = this.formatValue(inputValue);

    this.updateValue(formatted);
  }

  onKeyDown(event: KeyboardEvent) {
    const mode = this.type();
    const safeKeys = ['Backspace', 'ArrowLeft', 'ArrowRight', 'Tab', 'Delete'];

    const keyRules: Record<InputMode, RegExp | null> = {
      phone: /^\d$/,
      name: /^[a-zA-Z\s\-'.]$/,
      email: /^[^\s]$/, // Block all spaces in email
      text: null,
      password: null,
    };
    //  Text
    if (this.type() === 'text') {
      const input = event.target as HTMLInputElement;

      if (event.key === ' ' && input.value.endsWith(' ')) {
        event.preventDefault();
      }

      if (event.key === ' ' && input.selectionStart === 0) {
        event.preventDefault();
      }
    }

    // Name
    if (this.type() === 'name') {
      const input = event.target as HTMLInputElement;

      if (event.key === ' ' && input.value.endsWith(' ')) {
        event.preventDefault();
      }

      if (event.key === ' ' && input.selectionStart === 0) {
        event.preventDefault();
      }
    }

    const rule = keyRules[mode];

    if (rule && !safeKeys.includes(event.key) && !rule.test(event.key)) {
      event.preventDefault();
    }
  }

  onBlur(event: FocusEvent) {
    this.isFocused.set(false);
    this.touched.set(true);
    this.control?.markAsTouched();

    this._onTouched();
    this.inputBlur.emit(event);
  }

  onFocus(event: FocusEvent) {
    this.isFocused.set(true);
    this.inputFocus.emit(event);
  }

  togglePassword() {
    this.showPassword.update((v) => !v);
  }

  // ───────────── HELPERS ──────────
  private getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private updateValue(value: string) {
    this.value.set(value);
    this._onChange(value);
    this.valueChange.emit(value);

    this.control?.updateValueAndValidity({ emitEvent: false });
  }

  private formatValue(value: string): string {
    const mode = this.type();

    if (mode === 'phone') {
      return value.replace(/\D/g, '').slice(0, 10);
    }

    if (mode === 'name') {
      return value
        .replace(/\s{2,}/g, ' ')
        .replace(/^\s/, '')
        .replace(/(^|\s)(\S)/g, (m, p1, p2) => p1 + p2.toUpperCase());
    }

    if (mode === 'text') {
      return value
        .replace(/\s{2,}/g, ' ')
        .replace(/^\s/, '');
    }

    return value;
  }
}
