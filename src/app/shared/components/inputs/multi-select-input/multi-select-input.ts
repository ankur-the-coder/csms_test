import {
  Component,
  forwardRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  ChangeDetectorRef,
  SimpleChanges,
  ViewChild,
  ElementRef,
  HostListener,
  OnDestroy
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
// TranslatePipe removed — component templates use raw labels now
export interface Option {
  id?: string | number;
  value: number | string;
  label: string;
  disabled?: boolean;
}

/** Resolves a CSS variable to its computed value at runtime. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

@Component({
  selector: 'app-multi-select-input',
  imports: [FormsModule],
  templateUrl: './multi-select-input.html',
  styleUrl: './multi-select-input.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectInput),
      multi: true,
    },
  ],
})
export class MultiSelectInput implements OnDestroy {    /* ------------------------------------------------------------------ */

  @Input() label: string = '';
  @Input() options: Option[] = [];
  @Output() selectionChange = new EventEmitter<string[]>();

  @Input() enableSearch: boolean = false;
  @Input() tooltipEnabled: boolean = false;
  @Input() placeholder: string = 'Please select';
  @Input() required: boolean = false;
  @Input() maxSelections: number | null = null;
  @Input() loadingState: 'fetching' | 'fetched' | 'failed' = 'fetched';

  /* ------------------------------------------------------------------ */
  /* Theme helpers                                                        */
  /* ------------------------------------------------------------------ */


  /* ------------------------------------------------------------------ */
  /* State                                                                */
  /* ------------------------------------------------------------------ */

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  selectedOptions: Option[] = [];
  isOpen = false;
  @Input() disabled = false;
  showTooltip = false;
  showTooltipContent = false;
  value: any;
  searchTerm: string = '';
  closing = false;
  dropdownDirection: 'down' | 'up' = 'down';

  private onChange: (value: any) => void = () => { };
  private onTouched: () => void = () => { };

  constructor(private cdr: ChangeDetectorRef, private el: ElementRef) { }

  /* ------------------------------------------------------------------ */
  /* Close on outside click — no directive needed                        */
  /* ------------------------------------------------------------------ */

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    const clickedInside = (this.el.nativeElement as HTMLElement).contains(
      event.target as Node
    );
    if (!clickedInside) {
      this.startCloseAnimation();
    }
  }

  /* Close on Escape key */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.startCloseAnimation();
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                            */
  /* ------------------------------------------------------------------ */

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['options'] &&
      changes['options'].previousValue &&
      JSON.stringify(changes['options'].currentValue) !==
      JSON.stringify(changes['options'].previousValue)
    ) {
      this.writeValue(this.value);
    }

    if (changes['options']) {
      if (this.options && this.options.length > 0) {
        this.dataLoaded = true;
        this.stopLoadingTimer();
      } else if (this.isOpen && (!this.options || this.options.length === 0)) {
        this.startLoadingTimer();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* ControlValueAccessor                                                 */
  /* ------------------------------------------------------------------ */

  writeValue(value: Option[] | string[]): void {
    this.value = value;
    if (value && (value as any[]).length) {
      if (Array.isArray(value)) {
        if (typeof value[0] === 'string') {
          this.selectedOptions = [
            ...this.options.filter((item) =>
              value.includes(String(item.value) as any)
            ),
          ];
        } else if (typeof value[0] === 'object' && (value[0] as Option).label) {
          this.selectedOptions = [...value] as Option[];
        }
      }
    } else {
      this.selectedOptions = [];
    }
    this.cdr.detectChanges();
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  /* ------------------------------------------------------------------ */
  /* Filtered options                                                     */
  /* ------------------------------------------------------------------ */

  get filteredOptions(): Option[] {
    if (!this.enableSearch || !this.searchTerm) return this.options;
    const term = this.searchTerm.toLowerCase();
    return this.options.filter((o) => o.label.toLowerCase().includes(term));
  }

  /* ------------------------------------------------------------------ */
  /* Dropdown toggle                                                      */
  /* ------------------------------------------------------------------ */

  toggleDropdown(): void {
    if (this.disabled || this.closing) return;

    if (this.isOpen) {
      this.startCloseAnimation();
    } else {
      this.setDropdownDirection();
      this.isOpen = true;
      this.closing = false;

      if (this.filteredOptions.length === 0) {
        this.startLoadingTimer();
      } else {
        this.stopLoadingTimer();
      }

      setTimeout(() => {
        if (this.enableSearch && this.searchInput) {
          this.searchInput.nativeElement.focus();
        }
      }, 0);
    }
  }

  private startCloseAnimation(): void {
    if (this.closing) return;
    this.closing = true;
    this.isOpen = false;
    this.closing = false;
    this.onTouched();
    if (this.enableSearch) this.clearSearch();
  }

  private setDropdownDirection(): void {
    const bounds = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
    if (!bounds) return;

    const spaceBelow = window.innerHeight - bounds.bottom;
    const spaceAbove = bounds.top;
    const dropdownHeight = 220;

    this.dropdownDirection =
      spaceBelow < dropdownHeight && spaceAbove > dropdownHeight ? 'up' : 'down';
  }

  /* ------------------------------------------------------------------ */
  /* Selection logic                                                      */
  /* ------------------------------------------------------------------ */

  toggleOption(option: Option): void {
    if (option.disabled || this.disabled) return;

    const isSelected = this.isSelected(option);
    const atLimit =
      this.maxSelections !== null &&
      this.selectedOptions.length >= this.maxSelections;

    if (!isSelected && atLimit) return;

    const index = this.selectedOptions.findIndex(
      (item) => item.value === option.value
    );

    this.selectedOptions =
      index === -1
        ? [...this.selectedOptions, option]
        : [
          ...this.selectedOptions.slice(0, index),
          ...this.selectedOptions.slice(index + 1),
        ];

    this.emitChange();
  }

  removeOption(event: Event, option: Option): void {
    event.stopPropagation();
    this.selectedOptions = this.selectedOptions.filter(
      (o) => o.value !== option.value
    );
    this.emitChange();
  }

  isSelected(option: Option): boolean {
    return this.selectedOptions.some((item) => item.value === option.value);
  }

  isAllSelected(): boolean {
    return (
      this.filteredOptions.length > 0 &&
      this.filteredOptions.every((opt) => this.isSelected(opt) || opt.disabled)
    );
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedOptions = checked
      ? this.filteredOptions.filter((opt) => !opt.disabled)
      : [];
    this.emitChange();
  }

  clearAll(): void {
    this.selectedOptions = [];
    this.value = [];
    this.onChange([]);
    this.selectionChange.emit([]);
    this.cdr.detectChanges();
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  /* ------------------------------------------------------------------ */
  /* Display helpers                                                      */
  /* ------------------------------------------------------------------ */

  getSelectedLabels(): string {
    if (this.selectedOptions.length === 0) return this.placeholder;
    return this.selectedOptions.map((o) => o.label).join(', ');
  }

  /* ------------------------------------------------------------------ */
  /* Hover helpers                                                        */
  /* ------------------------------------------------------------------ */

  setButtonHover(target: EventTarget | null, hovered: boolean): void {
    if (!target) return;
    (target as HTMLElement).style.background = hovered
      ? 'color-mix(in srgb, #ef4444 10%, transparent)'
      : 'transparent';
  }

  setOptionHover(target: EventTarget | null, option: Option, hovered: boolean): void {
    if (!target || option.disabled || this.isSelected(option)) return;
    (target as HTMLElement).style.background = hovered ? 'var(--surface-100)' : 'transparent';
  }

  /* ------------------------------------------------------------------ */
  /* Private                                                              */
  /* ------------------------------------------------------------------ */

  private emitChange(): void {
    this.value = this.selectedOptions.map((item) => String(item.value));
    this.onChange(this.value);
    this.selectionChange.emit(this.value);
  }

  // Loader Logic
  private loadingTimeout: any;
  showLoader: boolean = false;
  private dataLoaded: boolean = false;

  private startLoadingTimer(): void {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    this.showLoader = true;
    this.dataLoaded = false;
    this.cdr.detectChanges();
    this.loadingTimeout = setTimeout(() => {
      this.showLoader = false;
      this.cdr.detectChanges();
    }, 2000);
  }

  onSearchChange(event: any): void {
    if (this.filteredOptions.length === 0) {
      this.startLoadingTimer();
    } else {
      this.stopLoadingTimer();
    }
  }

  private stopLoadingTimer(): void {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
    this.showLoader = false;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.stopLoadingTimer();
  }
}