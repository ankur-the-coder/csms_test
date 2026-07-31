import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { signal } from '@angular/core';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ButtonType = 'button' | 'submit' | 'reset';

const VARIANT_SOLID: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 border-brand-600 text-white hover:bg-brand-700 hover:border-brand-700 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',

  secondary:
    'bg-surface-100 border-surface-300 text-text-primary hover:bg-surface-200 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',

  success:
    'bg-btn-success border-btn-success text-white hover:bg-btn-success-hover hover:border-btn-success-hover hover:shadow-md focus-visible:ring-2 focus-visible:ring-btn-success focus-visible:ring-offset-2',

  danger:
    'bg-btn-danger border-btn-danger text-white hover:bg-btn-danger-hover hover:border-btn-danger-hover hover:shadow-md focus-visible:ring-2 focus-visible:ring-btn-danger focus-visible:ring-offset-2',

  warning:
    'bg-btn-warning border-btn-warning text-white hover:bg-btn-warning-hover hover:border-btn-warning-hover hover:shadow-md focus-visible:ring-2 focus-visible:ring-btn-warning focus-visible:ring-offset-2',

  info:
    'bg-btn-info border-btn-info text-white hover:bg-btn-info-hover hover:border-btn-info-hover hover:shadow-md focus-visible:ring-2 focus-visible:ring-btn-info focus-visible:ring-offset-2',
};

const VARIANT_OUTLINE: Record<ButtonVariant, string> = {
  primary:
    'bg-transparent border-brand-600 text-brand-600 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',

  secondary:
    'bg-transparent border-surface-300 text-text-secondary hover:bg-surface-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',

  success:
    'bg-transparent border-btn-success text-btn-success hover:bg-btn-success-subtle focus-visible:ring-2 focus-visible:ring-btn-success focus-visible:ring-offset-2',

  danger:
    'bg-transparent border-btn-danger text-btn-danger hover:bg-btn-danger-subtle focus-visible:ring-2 focus-visible:ring-btn-danger focus-visible:ring-offset-2',

  warning:
    'bg-transparent border-btn-warning text-btn-warning hover:bg-btn-warning-subtle focus-visible:ring-2 focus-visible:ring-btn-warning focus-visible:ring-offset-2',

  info:
    'bg-transparent border-btn-info text-btn-info hover:bg-btn-info-subtle focus-visible:ring-2 focus-visible:ring-btn-info focus-visible:ring-offset-2',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'text-xs px-2.5 py-1.5 gap-1',
  sm: 'text-sm px-3.5 py-2 gap-1.5',
  md: 'text-sm px-4 py-2 gap-1.5',
  lg: 'text-base px-5 py-3 gap-2',
  xl: 'text-base px-7 py-3.5 gap-2',
};

const BASE =
  'relative overflow-hidden inline-flex items-center justify-center whitespace-nowrap ' +
  'font-medium tracking-wide leading-tight select-none cursor-pointer ' +
  'rounded-lg border-[1.5px] ' +
  'transition-all duration-150 ease-in-out ' +
  'active:scale-[0.97] ' +
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100';


@Component({
  selector: 'custom-button',
  standalone: true,
  templateUrl: './custom-button.html',
  styleUrls: ['./custom-button.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomButton {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  type = input<ButtonType>('button');
  disabled = input<boolean>(false);
  loading = input<boolean>(false);
  outline = input<boolean>(false);
  fullWidth = input<boolean>(false);
  label = input<string>('');

  btnClick = output<MouseEvent>();


  ripple = signal<{ x: number; y: number; size: number } | null>(null);
  createRipple(event: MouseEvent): void {
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    this.ripple.set({
      x: event.clientX - rect.left - size / 2,
      y: event.clientY - rect.top - size / 2,
      size
    });

    setTimeout(() => this.ripple.set(null), 400);
  }

  classes = computed(() => {
    const cls = [
      BASE,
      this.outline()
        ? VARIANT_OUTLINE[this.variant()]
        : VARIANT_SOLID[this.variant()],
      SIZE_CLASSES[this.size()],
    ];

    if (this.fullWidth()) cls.push('w-full');
    if (this.loading()) cls.push('cursor-wait');

    return cls.join(' ');
  });

  handleClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) return;
    this.createRipple(event);
    this.btnClick.emit(event);
  }
}
