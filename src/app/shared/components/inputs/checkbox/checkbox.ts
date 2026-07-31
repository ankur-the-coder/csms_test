import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NG_VALUE_ACCESSOR, ControlValueAccessor, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true
    }
  ]
})
export class CheckboxComponent implements ControlValueAccessor {
  @Input() label: string = '';
  @Input() disabled: boolean = false;
  @Input() checked: boolean = false;
  @Input() indeterminate: boolean = false;

  @Output() change: EventEmitter<boolean> = new EventEmitter<boolean>();

  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: boolean): void {
    this.checked = !!value;
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

  onInputChange(event: Event): void {
    if (!this.disabled) {
      const input = event.target as HTMLInputElement;
      this.checked = input.checked;
      this.onChange(this.checked);
      this.onTouched();
      this.change.emit(this.checked);
    }
  }
}
