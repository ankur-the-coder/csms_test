import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostListener,
  Input,
  Output,
  SimpleChanges,
  ViewChild,
  OnDestroy,
  AfterViewChecked,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule, NgClass, NgStyle } from '@angular/common';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  selected?: boolean | string;
  isHeader?: boolean;
  requestTypeId?: string;
  allocated?: number;
    bgColor?: string;
     textColor?: string;
  from?: string;
  to?: string;
}

@Component({
  selector: 'app-single-input',
   standalone: true,
  imports: [CommonModule, NgClass, NgStyle, FormsModule,],
  templateUrl: './single-input.html',
  styleUrl: './single-input.css',
  host: {
    'class': 'block w-full'
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SingleInput),
      multi: true,
    },
  ],
})
export class SingleInput implements ControlValueAccessor {
   @Input() label: string = '';
  @Input() options: SelectOption[] = [];
  private _disabled = false;
  private _unselectable = false;

  @Input()
  get unselectable(): boolean {
    return this._unselectable;
  }
  set unselectable(value: boolean) {
    this._unselectable = !!value;
    if (this.disabled && this.isOpen) {
      this.closeDropdown();
    }
  }

  @Input()
  get disabled(): boolean {
    return this._disabled || this._unselectable;
  }
  set disabled(value: boolean) {
    this._disabled = !!value;
    if (this.disabled && this.isOpen) {
      this.closeDropdown();
    }
  }

  @Input() required: boolean = false;
  @Input() placeHolder: string = '';
  @Input() value: string = '';
  @Input() enableSearch: boolean = false;
  @Input() bgColor: string = ' ';
  @Input() customclass: string = ' ';
  @Input() httpSts: any = { msg: "", status: 1 }
  @Input() showToolTip: boolean = false;
  @Input() maxVisibleItems: number = 0;
  @Input() set forceClose(value: boolean) {
    if (value && this.isOpen) {
      this.closeDropdown();
    }
  }
  @Output() valueChange = new EventEmitter<any>();
  @Output() change = new EventEmitter<any>();
  @Output() optionChange = new EventEmitter<SelectOption>();
  @ViewChild('dropdown') dropdownElement!: ElementRef;
  @ViewChild('trigger') triggerElement!: ElementRef;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  searchTerm = '';
  dropdownPosition: 'bottom' | 'top' = 'bottom';
  dropdownCoords: { top?: number; bottom?: number; left: number; width: number } | null = null;
  isClosing: boolean = false;

  constructor(private eRef: ElementRef, private cdr: ChangeDetectorRef) { }

  isTouchDevice(): boolean {
    return window.matchMedia('(hover: none)').matches;
  }

  toggleDropdown(event?: MouseEvent) {
    if (this.enableSearch) this.clearSearch();

    if (!this.disabled) {
      if (this.isOpen) {
        this.closeDropdown();
      } else {
        this.isOpen = true;
        this.isClosing = false;
        this.calculateDropdownPosition();
        this.scrollToSelectedOption();
        this.shouldFocusSearch = true;
        if (this.filteredOptions.length === 0) {
          this.startLoadingTimer();
        } else {
          this.stopLoadingTimer();
        }
      }
    }
  }

  closeDropdown() {
    this.isOpen = false;
    this.isClosing = false;
    this.stopLoadingTimer();
    this.clearSearch();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target as Node)) {
      if (this.isOpen) {
        this.closeDropdown();
      }
    }
  }

  isOpen: boolean = false;
  selectedValue: string | number | null = null;
  private shouldFocusSearch = false;
  onChange = (value: any) => { };
  onTouched = () => { };

  // For search functionality
  private searchString: string = '';
  private searchTimeout: any;



  // Focus search input automatically
  ngAfterViewChecked(): void {
    if (this.shouldFocusSearch && this.searchInput) {
      try {
        this.searchInput.nativeElement.focus();
      } catch (err) {
        // Safe fail
      }
      this.shouldFocusSearch = false;
    }
  }

  calculateDropdownPosition() {
    if (!this.triggerElement) return;

    const triggerRect = this.triggerElement.nativeElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownMaxHeight = 200; // Max height from CSS
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    // Check if there's enough space below, otherwise open upward
    if (spaceBelow >= dropdownMaxHeight) {
      this.dropdownPosition = 'bottom';
    } else if (spaceAbove >= dropdownMaxHeight) {
      this.dropdownPosition = 'top';
    } else {
      // If neither has enough space, choose the side with more space
      this.dropdownPosition = spaceBelow > spaceAbove ? 'bottom' : 'top';
    }

    // Exact viewport coordinates so the dropdown can render with position:fixed
    // and escape any ancestor's overflow clipping (e.g. a scrollable modal body).
    this.dropdownCoords = this.dropdownPosition === 'bottom'
      ? { top: triggerRect.bottom + 6, left: triggerRect.left, width: triggerRect.width }
      : { bottom: viewportHeight - triggerRect.top + 6, left: triggerRect.left, width: triggerRect.width };
  }

  selectOption(option: SelectOption) {
    if (this.disabled || option.disabled) {
      return;
    }

    this.selectedValue = option.value;
    this.onChange(this.selectedValue);
    this.onTouched();
    this.change.emit(option.value);
    this.valueChange.emit(option.value);
    this.optionChange.emit(option);
    this.closeDropdown(); // Close dropdown after selection with animation
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  get filteredOptions(): SelectOption[] {
    if (!this.enableSearch || !this.searchTerm) {
      return this.options;
    }
    const lowerCaseSearchTerm = this.searchTerm.toLowerCase();
    return this.options.filter((option) =>
      option.label.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }

  writeValue(value: any): void {
    this.selectedValue = value;
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

  isSelected(option: SelectOption): boolean {
    return this.selectedValue == option.value;
  }

  // Helper method to get the label for the selected option
  getSelectedLabel(): string {
    const selectedOption = this.options.find(
      (option) => option.value == this.selectedValue
    );
    return selectedOption ? selectedOption.label : this.placeHolder;
  }

  jumpToOption(searchString: string): void {
    const lowerCaseSearchString = searchString.toLowerCase();
    const targetOption = this.options.find((option) =>
      option.label.toLowerCase().startsWith(lowerCaseSearchString)
    );

    if (targetOption) {
      const optionElements =
        this.dropdownElement.nativeElement.querySelectorAll('.custom-option');

      // Find the element that matches the target option's label
      optionElements.forEach(
        (optionElement: {
          textContent: string;
          scrollIntoView: (arg0: { block: string; behavior: string }) => void;
        }) => {
          if (
            optionElement.textContent
              ?.toLowerCase()
              .startsWith(lowerCaseSearchString)
          ) {
            optionElement.scrollIntoView({
              block: 'nearest',
              behavior: 'smooth',
            });
            return; // Exit the loop after scrolling to the first match
          }
        }
      );
    }
  }



  @HostListener('window:resize')
  onWindowResize() {
    if (this.isOpen) {
      this.calculateDropdownPosition();
    }
  }

  // Scroll to the selected option
  scrollToSelectedOption() {
    setTimeout(() => {
      // try {
      const selectedOptionElement: HTMLElement =
        this.dropdownElement.nativeElement.querySelector('.selected-option');
      const dropdownContainer = this.dropdownElement.nativeElement;
      if (selectedOptionElement) {
        dropdownContainer.scrollTop =
          selectedOptionElement.offsetTop - dropdownContainer.offsetTop;
      }
      // } catch {
      //   // console.log('sr')
      // }
    }, 50);
  }

  // Add these properties
  private loadingTimeout: any;
  showLoader: boolean = false;
  private readonly MAX_LOADING_TIME = 3000; // 10 seconds
  private dataLoaded: boolean = false;

  // Add this method
  private startLoadingTimer(): void {
    // Clear any existing timeout
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

  onSearchChange(event: any) {
    if (this.filteredOptions.length === 0) {
      this.startLoadingTimer();
    } else {
      this.stopLoadingTimer();
    }
  }

  // Add this method
  private stopLoadingTimer(): void {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
    this.showLoader = false;
    this.cdr.detectChanges();
  }

  // Update ngOnChanges to detect when options are loaded
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options']) {
      if (this.options && this.options.length > 0) {
        this.dataLoaded = true;
        this.stopLoadingTimer();
      } else if (this.isOpen && this.options && this.options.length === 0) {
        this.startLoadingTimer();
      }
    }
  }

  // Add cleanup
  ngOnDestroy(): void {
    this.stopLoadingTimer();
  }
}

