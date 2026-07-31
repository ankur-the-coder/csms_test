import {
  Component,
  input,
  signal,
  computed,
  output,
  forwardRef,
  effect
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule
} from '@angular/forms';

@Component({
  selector: 'app-text-area',
  standalone: true,
  imports: [NgClass, ReactiveFormsModule],
  templateUrl: './text-area.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextArea),
      multi: true
    }
  ]
})
export class TextArea implements ControlValueAccessor {

  label = input<string>('');
  placeholder = input<string>('');
  rows = input<number>(4);
  maxLength = input<number | null | undefined>(300);
  minLength = input<number | null | undefined>(3);
  required = input<boolean>(false);
  disabled = input<boolean>(false);
  readonly = input<boolean>(false);
  id = input<string>(
    `textarea-${Math.random().toString(36).substring(2, 9)}`
  );
  hint = input<string>('');

  // Parent Input
  // value = input<string>('');

  // Internal State
  internalValue = signal<string>('');

  error = signal<string>('');

  valueChange = output<string>();

  length = computed(() => this.internalValue().length);
  hasError = computed(() => !!this.error());

  // constructor() { 
  //   effect(() => {
  //     this.internalValue.set(this.value() ?? '');
  //   });
  // }

  onChange = (_: any) => { };
  onTouched = () => { };

  writeValue(val: any): void {
    this.internalValue.set(val ?? '');
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(_: boolean): void { }

  getValue(): string {
    return this.internalValue();
  }

  private validateValue(value: string): string {

    if (this.required() && !value.trim()) {
      return 'Required';
    }

    const minLen = this.minLength();

    // if (minLen != null && value.length < minLen) {
    //   return `Minimum ${minLen} characters required`;
    // }

    const maxLen = this.maxLength();

    if (maxLen != null && value.length > maxLen) {
      return `You can enter up to ${maxLen} characters only`;
    }

    if (/(.)\1{5,}/.test(value)) {
      return 'Same character cannot be repeated more than 5 times';
    }

    return '';
  }

  onInput(event: Event): void {

    const input = event.target as HTMLTextAreaElement;

    let val = input.value;

    val = val.replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
    val = val.replace(/(.)\1{4,}/g, (_, char) => char.repeat(5));

    this.internalValue.set(val);

    this.error.set(this.validateValue(val));

    this.onChange(val);

    this.valueChange.emit(val);
  }

  onBlur(): void {
    this.error.set(
      this.validateValue(this.internalValue())
    );

    this.onTouched();
  }

  onKeyDown(event: KeyboardEvent): void {

    if (event.key.length !== 1) return;

    const last5 = this.internalValue().slice(-5);

    if (
      last5.length === 5 &&
      last5.split('').every(c => c === event.key)
    ) {
      event.preventDefault();

      this.error.set(
        'Same character cannot be repeated more than 5 times'
      );
    }
  }
}
