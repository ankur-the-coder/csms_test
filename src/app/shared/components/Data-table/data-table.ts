import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  TemplateRef,
  AfterContentInit,
  ContentChildren,
  QueryList,
  HostListener,
  ViewChild,
  ViewChildren,
  ElementRef,
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CommonModule, DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  SmartTableConfig,
  SmartColumn,
  SortState,
  FilterState,
  RowActionEvent,
  RowAction,
  ToolbarButton,
  BulkAction,
  CustomRowAction,
  getByPath,
  TableFilter,
} from './data-table.types';

import { DatePicker } from '../inputs/date-picker/date-picker';
import { CustomColumnDirective } from './custom-column.directive';
import { DataTableService } from './data-table.service';
import { CustomDateSelector } from '../inputs/custom-date-selector/custom-date-selector';

import { SingleInput, SelectOption } from '../inputs/single-input/single-input';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-data-table',
  imports: [
    CommonModule,
    FormsModule,

    DecimalPipe,
    CurrencyPipe,
    CustomDateSelector,
    SingleInput,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTable<T extends object> implements AfterContentInit {
  @ViewChild('filterModal') filterModalRef!: ElementRef<HTMLDialogElement>;
  @ViewChild('colPickerModal') colPickerModalRef!: ElementRef<HTMLDialogElement>;
  @ViewChild('bulkActionModal') bulkActionModalRef!: ElementRef<HTMLDialogElement>;

  @ContentChildren(CustomColumnDirective)
  customTemplates!: QueryList<CustomColumnDirective>;

  @ViewChildren(SingleInput)
  singleInputComponents!: QueryList<SingleInput>;

  private http = inject(HttpClient);
  private dataTableService = inject(DataTableService);
  private _lastFetchKey = '';

  // ── Inputs ────────────────────────────────────────────────────────────────
  config = input.required<SmartTableConfig<T>>();
  actions = input<RowAction<any>[]>([]);
  filterNames = input<string[]>([]);
  initialDateFrom = input<string>('');
  initialDateTo = input<string>('');
  defaultPreset = input<
    'today' | 'currentMonth' | 'lastWeek' | 'last90days' | 'yesterday' | 'custom' | string
  >('today');
  disableFutureDates = input<boolean>(false);
  disablePastDates = input<boolean>(false);
  initialFilters = input<Record<string, any>>({});
  permissions = input<{ canEdit?: boolean }>({ canEdit: true });
  excludePdfColumns = input<string[]>([]);
  excludeExportColumns = input<string[]>([]);

  // ── Outputs ───────────────────────────────────────────────────────────────
  rowClick = output<T>();
  rowAction = output<RowActionEvent<T>>();
  selectionChange = output<T[]>();
  toolbarButtonClick = output<{ buttonId: string; selectedRows: T[]; allRows: T[] }>();
  onRefresh = output<void>();

  // ── State signals ─────────────────────────────────────────────────────────
  searchRaw = signal('');
  activeFilters = signal<FilterState>({ search: '' });
  tempFilters = signal<Record<string, any>>({});
  sort = signal<SortState<T>>({ key: null, dir: 'asc' });
  page = signal(0);
  pageSize = signal(10);
  rows = signal<T[]>([]);
  totalCount = signal(0);
  loadState = signal<LoadState>('idle');
  errorMessage = signal('');
  refreshTrigger = signal(0);
  isSpinning = signal(false);
  selectedIds = signal<Set<string>>(new Set());
  colVisibility = signal<Record<string, boolean>>({});
  exportMenuOpen = signal(false);
  initialLoadDone = signal(false);
  colWidths = signal<Record<string, number | undefined>>({});
  colOrder = signal<string[]>([]);
  dragSrcKey = signal<string | null>(null);
  dragOverKey = signal<string | null>(null);
  pageSizePopoverOpen = signal(false);
  private wasDragging = signal(false);
  activeDropdownKey = signal<string | null>(null);
  // Viewport-relative coordinates for the currently open dropdown popover.
  // Computed from the trigger button's own bounding rect so the popover can
  // render with position:fixed and escape the modal body's overflow-y-auto
  // clipping (view-only fix — no filter/search behaviour changes).
  dropdownPosition = signal<{ top: number; left: number; width: number } | null>(null);

  // Modal open states (using native <dialog>)
  filterModalOpen = signal(false);
  colPickerModalOpen = signal(false);
  bulkActionModalOpen = signal(false);
  pdfColumnModalOpen = signal(false);

  // ── PDF export state ──────────────────────────────────────────────────────
  pdfExporting = signal(false);
  pdfProgress = signal(0);
  pdfPageSize = signal<'A4' | 'A3' | 'A2' | 'A1'>('A4');
  pdfRowLimit = signal<'current' | 'all' | number>('all');
  pdfSelectedColumns = signal<string[]>([]);
  private pdfCancelRequested = false;
  readonly PAGE_SIZE_LIMITS: Record<string, number> = {
    A4: 10,
    A3: 15,
    A2: 20,
    A1: 30,
  };

  // ── Date range ────────────────────────────────────────────────────────────
  dateFrom = signal('');
  dateTo = signal('');

  // Feeds app-custom-date-selector's [initialDates] input. Wrapped in computed()
  // so it only produces a NEW object reference when the underlying primitives
  // actually change — an inline object literal in the template would create a
  // new reference every change-detection cycle and spam CustomDateSelector's
  // ngOnChanges.
  initialDatesForPicker = computed(() => ({
    from: this.initialDateFrom(),
    to: this.initialDateTo(),
  }));

  // Seeds dateFrom/dateTo from the initialDateFrom/initialDateTo inputs
  // whenever they're set (e.g. navigated in from the dashboard with a
  // date range already applied). Runs as an effect (not just once in
  // ngAfterContentInit) so it also reacts if the same routed component
  // instance is reused with new query params.

  private applyInitialDatesEffect = effect(() => {
    const from = this.initialDateFrom();
    const to = this.initialDateTo();
    if (from && to) {
      untracked(() => {
        this.dateFrom.set(from);
        this.dateTo.set(to);
        this.page.set(0);
      });
    }
  });

  private applyInitialFiltersEffect = effect(() => {
    const init = this.initialFilters();
    if (init && Object.keys(init).length > 0) {
      untracked(() => {
        this.activeFilters.update((f) => ({ ...f, ...init }));
        this.tempFilters.set({ ...init });
        this.page.set(0);
      });
    }
  });

  // ── Filter options ─────────────────────────────────────────────────────────
  loadedFilters = signal<TableFilter[]>([]);
  private filtersFetched = false; // true once at least one filter has been successfully loaded from the API

  allFilters = computed(() => {
    const cfgFilters = this.config().filters ?? [];
    const loaded = this.loadedFilters();
    const map = new Map<string, TableFilter>();
    // loaded (from filterNames → DataTableService) first, then config.filters override
    loaded.forEach((f) => map.set(f.key, f));
    cfgFilters.forEach((f) => map.set(f.key, f));
    return Array.from(map.values());
  });

  // private loadFiltersEffect = effect(() => {
  //   const names = this.filterNames();
  //   if (names && names.length) {
  //     untracked(() => {
  //       this.loadFilterOptionsIfNeeded();
  //     });
  //   }
  // });

  // Resolves each name in `filterNames` (e.g. ['gender', 'qualification']) via
  // DataTableService.getFilterOptions(name), which returns the full TableFilter
  // (label + options) for that name — static or API-backed. Runs whenever the
  // parent changes the filterNames input.
 private filtersLoading = false;
  private loadFilterOptionsIfNeeded(): void {
    const names = this.filterNames();
     if (!names.length || this.filtersFetched || this.filtersLoading) return;

    forkJoin(
      names.map((n) =>
        this.dataTableService.getFilterOptions(n).pipe(
          catchError((err) => {
            console.warn(`[DataTable] Failed to load filter options for "${n}":`, err);
            return of({ key: n, label: n, options: [] } as TableFilter);
          }),
        ),
      ),
    ).subscribe({
      next: (filters) => {
        this.loadedFilters.set(filters);

        // Mark it as "fetched" only if at least one filter has real options.
        // If all filters are empty (fail/empty case),
        // keep the flag false so that it can be tried again the next time
        // the modal is opened.
        const gotRealData = filters.some((f) => (f.options?.length ?? 0) > 0);
        this.filtersFetched = gotRealData;
        this.filtersLoading = false;
      },
      error: (err) => {
        console.error('[DataTable] Error loading filters:', err);
        this.loadedFilters.set([]);
        this.filtersFetched = false;
        this.filtersLoading = false;
      },
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  visibleColumns = computed<SmartColumn<any>[]>(() => {
    const order = this.colOrder();
    const vis = this.colVisibility();
    const cols = this.config().columns;
    const colMap = new Map(cols.map((c) => [String(c.key), c]));
    const ordered = order.length
      ? order.map((k) => colMap.get(k)).filter((c): c is SmartColumn<any> => !!c)
      : cols;
    return ordered.filter((col) => {
      if (col.hideable === false) return true; // always shown, can't be hidden
      const override = vis[col.key as string];
      return override !== undefined ? override : !col.hidden;
    });
  });

  totalPages = computed(() => {
    if (this.config().showPagination === false) return 1;
    const size = this.pageSize() || 10;
    const total = this.totalCount() || 0;
    return Math.max(1, Math.ceil(total / size));
  });

  private pageGuardEffect = effect(() => {
    const maxPage = Math.max(0, this.totalPages() - 1);
    if (this.page() > maxPage) {
      untracked(() => this.page.set(maxPage));
    }
  });

  pageButtons = computed<number[]>(() => {
    if (this.config().showPagination === false) return [0];
    const tp = this.totalPages(),
      cur = this.page();
    if (tp <= 0) return [0];

    const maxVisible = 5; // Number of visible numeric buttons
    let start = cur - 2;
    let end = cur + 2;

    // Adjust bounds when near the start
    if (start < 0) {
      start = 0;
      end = Math.min(maxVisible - 1, tp - 1);
    }

    // Adjust bounds when near the end
    if (end >= tp) {
      end = tp - 1;
      start = Math.max(0, tp - maxVisible);
    }

    const btns: number[] = [];
    for (let i = start; i <= end; i++) {
      btns.push(i);
    }
    return btns;
  });

  // Client-side mode
  private clientRows = computed<T[]>(() => {
    const cfg = this.config();
    if (cfg.apiConfig) return this.rows();
    let data = cfg.staticData ?? [];
    const f = this.activeFilters();

    if (f.search) {
      const q = (f.search as string).toLowerCase();
      data = data.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(q),
        ),
      );
    }

    // Apply every other active filter from the modal (matched by TableFilter.key
    // against `filter.key + '_min'/'_max'` for range, array for multiSelect, else
    // a plain equality match).
    const rangeKeys = new Set(
      this.allFilters()
        .filter((fl) => fl.type === 'range')
        .map((fl) => fl.key),
    );
    const dateRangeKeys = new Set(
      this.allFilters()
        .filter((fl) => fl.type === 'daterange')
        .map((fl) => fl.key),
    );
    Object.entries(f).forEach(([key, value]) => {
      if (key === 'search') return;
      if (value === null || value === undefined || value === '') return;
      if (Array.isArray(value) && value.length === 0) return;

      if (rangeKeys.has(key)) return; // handled separately below via _min/_max
      if ([...dateRangeKeys].some((k) => key === `${k}_from` || key === `${k}_to`)) return;

      if (key.endsWith('_min') || key.endsWith('_max')) {
        const baseKey = key.replace(/_(min|max)$/, '');
        const isMin = key.endsWith('_min');
        data = data.filter((row) => {
          const rowVal = Number((row as any)[baseKey]);
          if (Number.isNaN(rowVal)) return false;
          return isMin ? rowVal >= Number(value) : rowVal <= Number(value);
        });
        return;
      }

      if (key.endsWith('_from') || key.endsWith('_to')) {
        const baseKey = key.replace(/_(from|to)$/, '');
        const isFrom = key.endsWith('_from');
        data = data.filter((row) => {
          const raw = (row as any)[baseKey];
          if (!raw) return false;
          const t = new Date(raw).getTime();
          if (Number.isNaN(t)) return false;
          const bound = new Date(String(value)).getTime();
          return isFrom ? t >= bound : t <= bound;
        });
        return;
      }

      if (Array.isArray(value)) {
        const set = new Set(value.map((v) => String(v)));
        data = data.filter((row) => set.has(String((row as any)[key])));
      } else {
        data = data.filter((row) => String((row as any)[key]) === String(value));
      }
    });

    // Date range (if the row has a date-like field matching a configured column)
    const from = this.dateFrom();
    const to = this.dateTo();
    if ((from || to) && cfg.dateRangeKey) {
      const key = cfg.dateRangeKey;
      data = data.filter((row) => {
        const raw = (row as any)[key];
        if (!raw) return false;
        const t = new Date(raw).getTime();
        if (Number.isNaN(t)) return false;
        if (from && t < new Date(from).getTime()) return false;
        if (to && t > new Date(to).getTime()) return false;
        return true;
      });
    }

    const { key, dir } = this.sort();
    if (key) {
      data = [...data].sort((a, b) => {
        const av = (a as any)[key],
          bv = (b as any)[key];
        if (typeof av === 'number' && typeof bv === 'number')
          return dir === 'asc' ? av - bv : bv - av;
        return dir === 'asc'
          ? String(av ?? '').localeCompare(String(bv ?? ''))
          : String(bv ?? '').localeCompare(String(av ?? ''));
      });
    }
    return data;
  });

  private clientPagedRows = computed<T[]>(() => {
    const data = this.clientRows();
    if (this.config().showPagination === false) return data;
    const start = this.page() * this.pageSize();
    return data.slice(start, start + this.pageSize());
  });

  private _clientTotalSync = effect(
    () => {
      if (!this.config().apiConfig) {
        this.totalCount.set(this.clientRows().length);
      }
    },
    // { allowSignalWrites: true }
  );

  displayRows = computed<any[]>(() =>
    this.config().apiConfig ? this.rows() : this.clientPagedRows(),
  );

  allSelected = computed<boolean>(() => {
    const rows = this.displayRows().filter((r) => !r.__isGroupHeader);
    if (!rows.length) return false;
    const ids = this.selectedIds();
    const idKey = (this.config().rowIdKey ?? 'id') as string;
    const selectableWhen = this.config().selectableWhen;
    const selectableRows = selectableWhen ? rows.filter((r) => selectableWhen(r)) : rows;
    if (!selectableRows.length) return false;
    return selectableRows.every((r) => ids.has(String((r as any)[idKey])));
  });

  selectedCount = computed(() => this.selectedIds().size);

  hasActiveFilter = computed(() => {
    const f = this.activeFilters();
    return Object.entries(f).some(([k, v]) => {
      if (k === 'search') return false;
      if (Array.isArray(v)) return v.length > 0;
      return v !== null && v !== undefined && v !== '';
    });
  });

  allRows = computed<T[]>(() => (this.config().apiConfig ? this.rows() : this.clientRows()));

  selectedRows = computed<T[]>(() => {
    const idKey = (this.config().rowIdKey ?? 'id') as string;
    const ids = this.selectedIds();
    return this.allRows().filter((r) => ids.has(String((r as any)[idKey])));
  });

  isInitialLoading = computed(() => {
    if (!this.config().apiConfig) return this.config().isLoading ?? false;
    return this.loadState() === 'loading' && !this.initialLoadDone();
  });

  isRefreshing = computed(() => this.loadState() === 'loading' && this.initialLoadDone());

  // Any load in progress that should block the table body with a loader —
  // used to fully hide stale rows instead of dimming them underneath.
  showTableLoader = computed(
    () => this.isInitialLoading() || this.isRefreshing() || this.isSpinning(),
  );

  templateMap = signal<Map<string, TemplateRef<any>>>(new Map());

  private buildTemplateMap(): void {
    const map = new Map<string, TemplateRef<any>>();
    this.customTemplates?.forEach((t) => map.set(t.columnName, t.template));
    this.templateMap.set(map);
  }

  hasData = computed(() => this.displayRows().length > 0);
  pageSizeOptions = computed(() => this.config().pageSizeOptions ?? [10, 25, 50, 100]);
  startRow = computed(() => this.page() * this.pageSize() + 1);
  endRow = computed(() => Math.min((this.page() + 1) * this.pageSize(), this.totalCount()));

  groupedRows = computed<any[]>(() => {
    const cfg = this.config();
    const rows = this.displayRows();
    if (!cfg.groupBy) return rows;
    const result: any[] = [];
    let lastGroupValue: any = undefined;
    for (const row of rows) {
      const groupValue = (row as any)[cfg.groupBy!];
      if (groupValue !== lastGroupValue) {
        result.push({
          __isGroupHeader: true,
          __groupValue: cfg.groupLabel ? cfg.groupLabel(groupValue) : groupValue,
        });
        lastGroupValue = groupValue;
      }
      result.push(row);
    }
    return result;
  });

  // ── MAIN FETCH EFFECT ─────────────────────────────────────────────────────
  private fetchEffect = effect((onCleanup) => {
    const cfg = this.config();
    if (!cfg.apiConfig) return;

    const currentPage = this.page();
    const currentSize = this.pageSize();
    const currentSort = this.sort();
    const currentFilters = this.activeFilters();
    const currentFrom = this.dateFrom();
    const currentTo = this.dateTo();
    const currentTrigger = this.refreshTrigger();

    untracked(() => {
      const { endpoint, buildRequest, dataPath, totalPath, transformRow } = cfg.apiConfig!;

      const ctx = {
        page: currentPage,
        pageSize: currentSize,
        sortKey: currentSort.key ? String(currentSort.key) : null,
        sortDir: currentSort.dir,
        search: (currentFilters.search as string) ?? '',
        filters: Object.fromEntries(Object.entries(currentFilters).filter(([k]) => k !== 'search')),
        dateFrom: currentFrom,
        dateTo: currentTo,
        refresh: () => this.refresh(),
      };

      // Build request first — its serialised body forms part of the cache key.
      // This ensures that when the parent changes a closure variable inside
      // buildRequest (e.g. a status-filter signal), the new payload is detected
      // and a fresh HTTP call is made even if page / sort / search are unchanged.
      const req = buildRequest ? buildRequest(ctx) : null;

      const fetchKey = [
        endpoint,
        currentPage,
        currentSize,
        JSON.stringify(currentSort),
        JSON.stringify(currentFilters),
        currentFrom,
        currentTo,
        currentTrigger,
        JSON.stringify(req?.body ?? ''), // ← captures external filter changes
      ].join('|');

      if (fetchKey === this._lastFetchKey) return;
      this._lastFetchKey = fetchKey;

      this.loadState.set('loading');
      this.errorMessage.set('');

      const dp = dataPath ?? 'data';
      const tp = totalPath ?? 'total';

      let request$;

      if (buildRequest && req) {
        if (req.method === 'GET') {
          const url = req.query ? `${endpoint}?${req.query}` : endpoint;
          request$ = this.http.get<unknown>(url, { headers: req.headers ?? {} });
        } else {
          request$ = this.http.post<unknown>(endpoint, req.body ?? '', {
            headers: req.headers ?? {},
          });
        }
      } else {
        const pm = cfg.apiConfig!.paramMap ?? {};
        let httpParams = new HttpParams()
          .set(pm.page ?? 'page', String(currentPage + 1))
          .set(pm.pageSize ?? 'pageSize', String(currentSize));
        if (currentSort.key) {
          httpParams = httpParams
            .set(pm.sortKey ?? 'sort', String(currentSort.key))
            .set(pm.sortDir ?? 'dir', currentSort.dir);
        }
        if (ctx.search) {
          httpParams = httpParams.set(pm.search ?? 'q', ctx.search);
        }
        request$ = this.http.get<unknown>(endpoint, {
          params: httpParams,
          headers: cfg.apiConfig!.headers ?? {},
        });
      }

      let stale = false;
      const sub = request$.subscribe({
        next: (res) => {
          if (stale) return;
          const rawData = (getByPath(res, dp) as any[]) ?? [];
          const mapped = transformRow ? rawData.map(transformRow) : (rawData as T[]);
          const data = mapped.filter((r): r is T => r !== null && r !== undefined);
          const total = (getByPath(res, tp) as number) ?? data.length;
          this.rows.set(data);
          this.selectedIds.set(new Set());
          this.totalCount.set(total);
          this.loadState.set('success');
          this.initialLoadDone.set(true);
          this.isSpinning.set(false);
        },
        error: (err) => {
          if (stale) return;
          this._lastFetchKey = '';
          this.loadState.set('error');
          this.errorMessage.set(err?.message ?? 'Failed to load data');
          this.initialLoadDone.set(true);
          this.isSpinning.set(false);
        },
      });

      onCleanup(() => {
        stale = true;
        sub.unsubscribe();
      });
    });
  });

  // ── Search debounce ───────────────────────────────────────────────────────
  private searchInitDone = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchEffect = effect(() => {
    const raw = this.searchRaw();
    const debounce = this.config().searchDebounce ?? 300;
    if (!this.searchInitDone) {
      this.searchInitDone = true;
      return;
    }
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(0);
      this.activeFilters.update((f) => ({ ...f, search: raw }));
    }, debounce);
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  ngAfterContentInit(): void {
    const cfg = this.config();
    untracked(() => {
      const targetSize = cfg.defaultPageSize ?? cfg.pageSizeOptions?.[0] ?? 10;
      if (this.pageSize() !== targetSize) {
        this.pageSize.set(targetSize);
      }
      const vis: Record<string, boolean> = {};
      cfg.columns.forEach((c) => {
        // Non-hideable columns must always start visible, regardless of `hidden`.
        vis[c.key as string] = c.hideable === false ? true : !c.hidden;
      });
      this.colVisibility.set(vis);
      this.colOrder.set(cfg.columns.map((c) => String(c.key)));
    });

    // Build template map from projected ng-template[appCustomColumn] directives
    // and keep it in sync if templates are added/removed dynamically.
    this.buildTemplateMap();
    this.customTemplates.changes.subscribe(() => this.buildTemplateMap());

    // this.loadFilterOptionsIfNeeded();
  }

  // ── Date filter ────────────────────────────────────────────────────────────
  onDateApplied(from: string, to: string): void {
    this.dateFrom.set(from);
    this.dateTo.set(to);
    this.page.set(0);
  }

  // ── Filter modal ──────────────────────────────────────────────────────────
  openFilterModal(): void {
    const { search, ...current } = this.activeFilters();
    this.tempFilters.set({ ...current });
    this.loadFilterOptionsIfNeeded();
    this.filterModalOpen.set(true);
  }
  closeFilterModal(): void {
    this.filterModalOpen.set(false);
  }

  applyFilters(): void {
    const applied = Object.fromEntries(
      Object.entries(this.tempFilters()).filter(
        ([_, v]) =>
          v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
      ),
    );
    this.activeFilters.set({ search: this.searchRaw(), ...applied });
    this.page.set(0);
    this.closeFilterModal();
  }

  clearModalFilters(): void {
    this.tempFilters.set({});
  }

  getFilterSelectOptions(filter: TableFilter): SelectOption[] {
    return (filter.options || []).map((opt) => ({
      label: String(opt.label),
      value: opt.value,
    }));
  }

  resetDateOnClear = input<boolean>(false);

  clearFilters(): void {
    this.searchRaw.set('');
    this.activeFilters.set({ search: '' });
    this.tempFilters.set({});
    if (this.resetDateOnClear()) {
      const { from, to } = this.getDefaultDateRange();
      this.dateFrom.set(from);
      this.dateTo.set(to);
    }
    this.page.set(0);
  }

  private getDefaultDateRange(): { from: string; to: string } {
    const preset = this.defaultPreset(); // input already available: 'today' | 'currentMonth' | ...
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const today = new Date();

    switch (preset) {
      case 'currentMonth': {
        const from = new Date(today.getFullYear(), today.getMonth(), 1);
        const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { from: fmt(from), to: fmt(to) };
      }
      case 'lastWeek': {
        const to = new Date(today);
        const from = new Date(today);
        from.setDate(from.getDate() - 7);
        return { from: fmt(from), to: fmt(to) };
      }
      case 'last90days': {
        const to = new Date(today);
        const from = new Date(today);
        from.setDate(from.getDate() - 90);
        return { from: fmt(from), to: fmt(to) };
      }
      case 'yesterday': {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        return { from: fmt(y), to: fmt(y) };
      }
      case 'today':
      default:
        return { from: fmt(today), to: fmt(today) };
    }
  }

  removeChipFilter(key: string): void {
    const filter = this.allFilters().find((f) => f.key === key);
    this.activeFilters.update((f) => {
      const u = { ...f };
      delete u[key];
      if (filter?.type === 'range') {
        delete u[key + '_min'];
        delete u[key + '_max'];
      }
      if (filter?.type === 'daterange') {
        delete u[key + '_from'];
        delete u[key + '_to'];
      }
      return u;
    });
    this.tempFilters.update((f) => {
      const u = { ...f };
      delete u[key];
      if (filter?.type === 'range') {
        delete u[key + '_min'];
        delete u[key + '_max'];
      }
      if (filter?.type === 'daterange') {
        delete u[key + '_from'];
        delete u[key + '_to'];
      }
      return u;
    });
    this.page.set(0);
  }

  updateTempFilter(key: string, value: any): void {
    this.tempFilters.update((f) => ({ ...f, [key]: value }));
  }

  // ── Multi-select filter support (filter.multiSelect === true) ─────────────
  isTempFilterValueChecked(key: string, value: any): boolean {
    const v = this.tempFilters()[key];
    return Array.isArray(v) && v.some((x) => String(x) === String(value));
  }

  toggleTempMultiValue(key: string, value: any): void {
    this.tempFilters.update((f) => {
      const current: any[] = Array.isArray(f[key]) ? [...f[key]] : [];
      const idx = current.findIndex((x) => String(x) === String(value));
      if (idx > -1) current.splice(idx, 1);
      else current.push(value);
      return { ...f, [key]: current };
    });
  }

  hasFilterChip(filter: TableFilter): boolean {
    if (filter.type === 'range') {
      const min = this.activeFilters()[filter.key + '_min'];
      const max = this.activeFilters()[filter.key + '_max'];
      return !!(min || max);
    }
    if (filter.type === 'daterange') {
      const from = this.activeFilters()[filter.key + '_from'];
      const to = this.activeFilters()[filter.key + '_to'];
      return !!(from || to);
    }
    const value = this.activeFilters()[filter.key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  }

  getFilterChipLabel(filter: TableFilter): string {
    if (filter.type === 'range') {
      const min = this.activeFilters()[filter.key + '_min'];
      const max = this.activeFilters()[filter.key + '_max'];
      if (!min && !max) return '';
      return `${min || '…'} – ${max || '…'}`;
    }
    if (filter.type === 'daterange') {
      const from = this.activeFilters()[filter.key + '_from'];
      const to = this.activeFilters()[filter.key + '_to'];
      if (!from && !to) return '';
      return `${from || '…'} – ${to || '…'}`;
    }
    const value = this.activeFilters()[filter.key];
    if (!value) return '';
    if (Array.isArray(value)) {
      if (value.length === 0) return '';
      const labels = value.map((v) => {
        const opt = (filter.options ?? []).find((o) => String(o.value) === String(v));
        return opt?.label ?? String(v);
      });
      return labels.length === 1 ? labels[0] : `${labels.length} selected`;
    }
    const opt = (filter.options ?? []).find((o) => String(o.value) === String(value));
    return opt?.label ?? String(value);
  }

  // ── Bulk action modal ─────────────────────────────────────────────────────
  openBulkActionModal(): void {
    this.bulkActionModalOpen.set(true);
  }
  closeBulkActionModal(): void {
    this.bulkActionModalOpen.set(false);
  }

  // ── Column picker ─────────────────────────────────────────────────────────
  toggleColPicker(): void {
    this.colPickerModalOpen.set(true);
  }
  closeColPicker(): void {
    this.colPickerModalOpen.set(false);
  }
  toggleColVisibility(key: string, visible: boolean): void {
    const col = this.config().columns.find((c) => String(c.key) === key);
    if (col?.hideable === false) return; // locked column, ignore attempts to hide it
    this.colVisibility.update((v) => ({ ...v, [key]: visible }));
  }

  isColVisible(key: string): boolean {
    const col = this.config().columns.find((c) => String(c.key) === key);
    if (col && col.hideable === false) return true;
    const override = this.colVisibility()[key];
    return override !== undefined ? override : !col?.hidden;
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  onSort(key: keyof T): void {
    if (this.wasDragging()) return;
    this.sort.update((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
    this.page.set(0);
  }

  onSearch(value: string): void {
    this.searchRaw.set(value);
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  onPageChange(p: number): void {
    const maxPage = Math.max(0, this.totalPages() - 1);
    this.page.set(Math.max(0, Math.min(p, maxPage)));
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(0);
  }

  // ── Refresh ───────────────────────────────────────────────────────────────
  refresh(): void {
    this.isSpinning.set(true);
    this.refreshTrigger.update((v) => v + 1);
    this.selectedIds.set(new Set());
    this.onRefresh.emit();
  }

  // ── Export ────────────────────────────────────────────────────────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.exportMenuOpen.set(false);
    this.pageSizePopoverOpen.set(false);
    // Close any open filter dropdowns when clicking outside
    // if (this.activeDropdownKey() !== null) {
    //   this.closeAllDropdowns();
    // }

    // Close any open filter dropdown, unless the click was inside its own
    // trigger/popover (which live under .st-custom-select).
    const target = event.target as HTMLElement;
    if (this.activeDropdownKey() !== null && !target.closest('.st-custom-select')) {
      this.closeAllDropdowns();
    }
  }

  toggleExportMenu(): void {
    this.exportMenuOpen.update((v) => !v);
  }
  closeExportMenu(): void {
    this.exportMenuOpen.set(false);
  }

  // Shared cell sanitizer — strips tags, decodes common entities, trims.
  private sanitizeCell(value: unknown, emptyPlaceholder = ''): string {
    const cleaned = String(value ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return cleaned || emptyPlaceholder;
  }

  isColumnExcludedFromExport(col: SmartColumn<any>, isPdf = false): boolean {
    const key = String(col.key ?? '').toLowerCase();
    const defaultExcludes = ['actions', 'action', 'photo', 'rowactions'];
    if (defaultExcludes.includes(key)) {
      return true;
    }

    if (col.excludeFromExport) return true;
    if (isPdf && col.excludeFromPdf) return true;

    const inputPdfExcludes = (this.excludePdfColumns() || []).map((k) => String(k).toLowerCase());
    const inputExportExcludes = (this.excludeExportColumns() || []).map((k) =>
      String(k).toLowerCase(),
    );
    const cfgPdfExcludes = (this.config().excludePdfColumns || []).map((k) =>
      String(k).toLowerCase(),
    );
    const cfgExportExcludes = (this.config().excludeExportColumns || []).map((k) =>
      String(k).toLowerCase(),
    );

    if (inputExportExcludes.includes(key) || cfgExportExcludes.includes(key)) return true;
    if (isPdf && (inputPdfExcludes.includes(key) || cfgPdfExcludes.includes(key))) return true;

    return false;
  }

  private exportableColumns(): SmartColumn<any>[] {
    return this.config().columns.filter((c) => !this.isColumnExcludedFromExport(c, false));
  }

  /** Formats a cell value according to its column type, badgeMap, dates, booleans, numbers, or custom formatter. */
  formatExportCell(row: any, col: SmartColumn<any>): string {
    const rawVal = getByPath(row, col.key as string);

    // If column has custom formatter
    if (col.formatter) {
      try {
        return this.sanitizeCell(col.formatter(rawVal, row), '—');
      } catch (e) {
        console.warn('Column formatter error:', e);
      }
    }

    if (rawVal === null || rawVal === undefined || rawVal === '') {
      return '—';
    }

    // Badge mapping (handles status, priority, badge columns)
    if (col.type === 'badge' || col.badgeMap) {
      if (col.badgeMap) {
        const entry = col.badgeMap[String(rawVal)];
        if (entry?.label !== undefined) return this.sanitizeCell(entry.label, '—');
      }
      return this.sanitizeCell(this.getBadgeLabel(col, rawVal), '—');
    }

    // Boolean
    if (col.type === 'boolean' || typeof rawVal === 'boolean') {
      return rawVal ? 'Yes' : 'No';
    }

    // Duration formatting (e.g. '01:00:00.000000', '00:30:00', or 60)
    const colKeyLower = col.key.toString().toLowerCase();
    if (
      colKeyLower === 'duration' ||
      colKeyLower.includes('duration') ||
      (col.type as string) === 'duration'
    ) {
      const dStr = String(rawVal).trim();
      if (!dStr || dStr === '0' || dStr === '00:00:00' || dStr === '00:00:00.000000')
        return '0 mins';
      if (/hour|min|sec/i.test(dStr)) return dStr;
      if (dStr.includes(':')) {
        const parts = dStr.split('.')[0].split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const s = parseInt(parts[2], 10) || 0;
        const res: string[] = [];
        if (h > 0) res.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
        if (m > 0) res.push(`${m} ${m === 1 ? 'min' : 'mins'}`);
        if (h === 0 && m === 0 && s > 0) res.push(`${s} ${s === 1 ? 'sec' : 'secs'}`);
        return res.join(' ') || '0 mins';
      }
      const num = Number(dStr);
      if (!isNaN(num) && num > 0) {
        const h = Math.floor(num / 60);
        const m = num % 60;
        const res: string[] = [];
        if (h > 0) res.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
        if (m > 0) res.push(`${m} ${m === 1 ? 'min' : 'mins'}`);
        return res.join(' ') || `${num} mins`;
      }
      return dStr;
    }

    // Explicit date type
    if (col.type === 'date') {
      return this.formatDateCell(rawVal);
    }

    // Automatic date/time detection for strings
    if (typeof rawVal === 'string') {
      const isDateKey =
        colKeyLower.includes('time') ||
        colKeyLower.includes('date') ||
        colKeyLower.endsWith('_at') ||
        colKeyLower === 'at' ||
        /[a-z]At$/.test(col.key.toString());
      const isIsoPattern =
        /^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(rawVal) || /^\d{4}-\d{2}-\d{2}$/.test(rawVal);

      if (isDateKey || isIsoPattern) {
        if (/^0000-00-00/.test(rawVal.trim()) || rawVal.trim() === '0') {
          return '-';
        }
        try {
          const d = new Date(rawVal);
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            if (year < 1000 || String(year).startsWith('0') || year <= 0) {
              return '-';
            }
            const hasTime =
              rawVal.includes('T') ||
              rawVal.includes(':') ||
              d.getHours() > 0 ||
              d.getMinutes() > 0;
            const dateStr = d.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            if (hasTime && isDateKey) {
              const timeStr = d.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
              return `${dateStr}, ${timeStr}`;
            }
            return dateStr;
          }
        } catch {}
      }
    }

    // Currency
    if (col.type === 'currency' && typeof rawVal === 'number') {
      return rawVal.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    }

    // Number
    if (col.type === 'number' && typeof rawVal === 'number') {
      return rawVal.toLocaleString();
    }

    return this.sanitizeCell(this.formatCellValue(rawVal), '—');
  }

  private timestampForFilename(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  }

  private timestampForDisplay(): string {
    const d = new Date();
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Returns all rows matching the current filters/sort/search, ignoring pagination.
   * Static-data mode: returns the already-filtered/sorted client rows.
   * API mode: re-requests the endpoint with pageSize = rowLimit (or total count),
   * so exports aren't limited to whatever page is currently on screen.
   */
  private async getAllDataForExport(rowLimit?: 'current' | 'all' | number): Promise<T[]> {
    const cfg = this.config();

    if (!cfg.apiConfig) {
      return rowLimit === 'current'
        ? this.displayRows().filter((r: any) => !r.__isGroupHeader)
        : this.clientRows();
    }

    const currentTotal = this.totalCount();
    if (currentTotal === 0) return [];

    const fetchSize =
      rowLimit === 'current'
        ? this.pageSize()
        : rowLimit === undefined || rowLimit === 'all'
          ? currentTotal
          : Math.min(rowLimit, currentTotal);

    const ctx = {
      page: 0,
      pageSize: fetchSize,
      sortKey: this.sort().key ? String(this.sort().key) : null,
      sortDir: this.sort().dir,
      search: (this.activeFilters().search as string) ?? '',
      filters: Object.fromEntries(
        Object.entries(this.activeFilters()).filter(([k]) => k !== 'search'),
      ),
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      refresh: () => this.refresh(),
    };

    const { endpoint, buildRequest, dataPath, transformRow } = cfg.apiConfig;
    const req = buildRequest ? buildRequest(ctx) : null;

    let request$;
    if (buildRequest && req) {
      if (req.method === 'GET') {
        const url = req.query ? `${endpoint}?${req.query}` : endpoint;
        request$ = this.http.get<unknown>(url, { headers: req.headers ?? {} });
      } else {
        request$ = this.http.post<unknown>(endpoint, req.body ?? '', {
          headers: req.headers ?? {},
        });
      }
    } else {
      const pm = cfg.apiConfig.paramMap ?? {};
      let params = new HttpParams()
        .set(pm.page ?? 'page', '1')
        .set(pm.pageSize ?? 'pageSize', String(fetchSize));
      if (ctx.sortKey) {
        params = params
          .set(pm.sortKey ?? 'sort', ctx.sortKey)
          .set(pm.sortDir ?? 'dir', ctx.sortDir);
      }
      if (ctx.search) params = params.set(pm.search ?? 'q', ctx.search);
      request$ = this.http.get<unknown>(endpoint, { params, headers: cfg.apiConfig.headers ?? {} });
    }

    const response = await request$.toPromise().catch(() => null);
    const rawData = (getByPath(response, dataPath ?? 'data') as any[]) ?? [];
    return transformRow
      ? rawData.map(transformRow).filter((r: T | null): r is T => r != null)
      : (rawData as T[]);
  }

  // ── CSV ───────────────────────────────────────────────────────────────────
  async exportCSV(): Promise<void> {
    this.closeExportMenu();
    this.pdfCancelRequested = false;
    this.pdfExporting.set(true);
    this.pdfProgress.set(1);
    const progressInterval = setInterval(() => {
      if (this.pdfCancelRequested) return;
      this.pdfProgress.update((p) => Math.min(p + Math.floor(Math.random() * 3) + 1, 90));
    }, 100);

    try {
      const data = await this.getAllDataForExport('all');
      if (this.pdfCancelRequested) return;

      const cols = this.exportableColumns();
      const sanitize = (v: unknown) => `"${this.sanitizeCell(v).replace(/"/g, '""')}"`;
      const header = ['S.No', ...cols.map((c) => c.label)].map(sanitize).join(',');
      const body = data.map((row, i) =>
        [i + 1, ...cols.map((c) => sanitize(this.formatExportCell(row, c)))].join(','),
      );

      this.pdfProgress.set(100);
      const csv = '\ufeff' + [header, ...body].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${this.config().exportFileName ?? 'table-data'}_${this.timestampForFilename()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      this.errorMessage.set('Failed to export CSV.');
      console.error('exportCSV:', err);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        this.pdfExporting.set(false);
        this.pdfProgress.set(0);
      }, 800);
    }
  }

  // ── Excel ─────────────────────────────────────────────────────────────────
  async exportExcel(): Promise<void> {
    this.closeExportMenu();
    this.pdfCancelRequested = false;
    this.pdfExporting.set(true);
    this.pdfProgress.set(1);
    const progressInterval = setInterval(() => {
      if (this.pdfCancelRequested) return;
      this.pdfProgress.update((p) => Math.min(p + Math.floor(Math.random() * 3) + 1, 90));
    }, 100);

    try {
      const data = await this.getAllDataForExport('all');
      if (this.pdfCancelRequested) return;

      const cols = this.exportableColumns();
      const worksheetData = data.map((row, idx) => {
        const obj: any = { 'S.No': idx + 1 };
        cols.forEach((col) => {
          obj[col.label] = this.formatExportCell(row, col);
        });
        return obj;
      });

      this.pdfProgress.set(100);
      const ws = XLSX.utils.json_to_sheet(worksheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(
        wb,
        `${this.config().exportFileName ?? 'table-data'}_${this.timestampForFilename()}.xlsx`,
      );
    } catch (err) {
      this.errorMessage.set('Failed to export Excel.');
      console.error('exportExcel:', err);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        this.pdfExporting.set(false);
        this.pdfProgress.set(0);
      }, 800);
    }
  }

  // ── PDF (with column picker) ─────────────────────────────────────────────
  openPdfColumnSelector(): void {
    this.closeExportMenu();
    this.pdfPageSize.set('A4');
    this.pdfRowLimit.set('all');
    const limit = this.PAGE_SIZE_LIMITS['A4'];
    const exportable = this.pdfExportableColumns();
    const visibleKeys = this.visibleColumns()
      .filter((c) => exportable.some((ec) => ec.key === c.key))
      .map((c) => c.key as string)
      .slice(0, limit);
    this.pdfSelectedColumns.set(visibleKeys);
    this.pdfColumnModalOpen.set(true);
  }

  closePdfColumnSelector(): void {
    this.pdfColumnModalOpen.set(false);
  }

  togglePdfColumn(key: string): void {
    const limit = this.PAGE_SIZE_LIMITS[this.pdfPageSize()];
    const current = this.pdfSelectedColumns();
    if (current.includes(key)) {
      this.pdfSelectedColumns.set(current.filter((k) => k !== key));
    } else {
      if (current.length >= limit) return;
      this.pdfSelectedColumns.set([...current, key]);
    }
  }

  isPdfColumnSelected(key: string): boolean {
    return this.pdfSelectedColumns().includes(key);
  }

  onPdfPageSizeChange(size: 'A4' | 'A3' | 'A2' | 'A1'): void {
    this.pdfPageSize.set(size);
    const limit = this.PAGE_SIZE_LIMITS[size];
    this.pdfSelectedColumns.update((cols) => cols.slice(0, limit));
  }

  cancelPdfExport(): void {
    this.pdfCancelRequested = true;
    this.pdfExporting.set(false);
    this.pdfProgress.set(0);
  }

  private reportLogoPromise: Promise<{
    original: HTMLImageElement;
    watermarkDataUrl: string;
  } | null> | null = null;

  /** Loads the ubiclient logo (from /onlyLogo.png) and creates a faded watermark data URL. */
  private getReportLogo(): Promise<{
    original: HTMLImageElement;
    watermarkDataUrl: string;
  } | null> {
    if (!this.reportLogoPromise) {
      this.reportLogoPromise = new Promise((resolve) => {
        const candidates = ['/onlyLogo.png', 'onlyLogo.png', '/logo.png', 'logo.png'];
        let idx = 0;

        const tryNext = () => {
          if (idx >= candidates.length) {
            resolve(null);
            return;
          }
          const src = candidates[idx++];
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            let watermarkDataUrl = '';
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || 400;
              canvas.height = img.naturalHeight || 400;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 0.12; // Faded watermark opacity
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                watermarkDataUrl = canvas.toDataURL('image/png');
              }
            } catch (e) {
              console.warn('Could not generate watermark canvas', e);
            }
            resolve({ original: img, watermarkDataUrl: watermarkDataUrl || img.src });
          };
          img.onerror = () => tryNext();
          img.src = src;
        };

        tryNext();
      });
    }
    return this.reportLogoPromise;
  }

  private buildAndSavePdf(
    rows: any[],
    exportColumns: SmartColumn<any>[],
    baseFileName: string,
    logoInfo: { original: HTMLImageElement; watermarkDataUrl: string } | null,
  ): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      format: this.pdfPageSize().toLowerCase() as any,
    });
    const generatedOn = this.timestampForDisplay();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;

    const drawWatermark = () => {
      if (logoInfo?.watermarkDataUrl) {
        const watermarkSize = Math.min(pageWidth, pageHeight) * 0.55;
        const aspect =
          (logoInfo.original.naturalHeight || 1) / (logoInfo.original.naturalWidth || 1);
        const wWidth = watermarkSize;
        const wHeight = watermarkSize * aspect;
        const wx = (pageWidth - wWidth) / 2;
        const wy = (pageHeight - wHeight) / 2 + 5;
        doc.addImage(logoInfo.watermarkDataUrl, 'PNG', wx, wy, wWidth, wHeight, undefined, 'FAST');
      }
    };

    const drawHeader = () => {
      if (logoInfo?.original) {
        const logoWidth = 20;
        const logoHeight =
          ((logoInfo.original.naturalHeight || 1) / (logoInfo.original.naturalWidth || 1)) *
          logoWidth;
        doc.addImage(logoInfo.original, 'PNG', 10, 5, logoWidth, logoHeight);
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text(baseFileName.replace(/[-_]/g, ' '), centerX, 13, { align: 'center' });

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 110, 120);
      doc.text(`Generated on: ${generatedOn}  •  Rows: ${rows.length}`, centerX, 19, {
        align: 'center',
      });
    };

    autoTable(doc, {
      head: [['S.No', ...exportColumns.map((c) => c.label)]],
      body: rows.map((row, idx) => [
        idx + 1,
        ...exportColumns.map((col) => this.formatExportCell(row, col)),
      ]),
      startY: 26,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        textColor: [33, 37, 41],
        fillColor: false,
        lineColor: [220, 225, 230],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [17, 24, 39],
        fontSize: 8.5,
        fontStyle: 'bold',
        lineColor: [209, 213, 219],
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: false,
      },
      margin: { top: 26, left: 10, right: 10, bottom: 12 },
      willDrawPage: () => {
        drawWatermark();
        drawHeader();
      },
    });

    const totalPages = (doc as any).internal.getNumberOfPages
      ? (doc as any).internal.getNumberOfPages()
      : doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(140, 150, 160);
      doc.text(`Generated: ${generatedOn}`, 10, pageHeight - 5);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageHeight - 5, { align: 'right' });
    }

    doc.save(`${baseFileName}_${this.timestampForFilename()}.pdf`);
  }

  async exportPDFWithColumns(): Promise<void> {
    const cfg = this.config();
    const selectedKeys = this.pdfSelectedColumns();
    if (!selectedKeys.length) {
      this.errorMessage.set('Select at least one column to export.');
      return;
    }

    const exportColumns = cfg.columns.filter((c) => selectedKeys.includes(c.key as string));
    const baseFileName = cfg.exportFileName ?? 'table-data';
    const logo = await this.getReportLogo();

    this.closePdfColumnSelector();
    this.pdfCancelRequested = false;
    this.pdfExporting.set(true);
    this.pdfProgress.set(20);

    try {
      const rows = await this.getAllDataForExport(this.pdfRowLimit());
      if (this.pdfCancelRequested) return;
      this.pdfProgress.set(80);
      this.buildAndSavePdf(rows, exportColumns, baseFileName, logo);
      this.pdfProgress.set(100);
    } catch (err) {
      this.errorMessage.set('Failed to generate PDF.');
      console.error('exportPDFWithColumns:', err);
    } finally {
      if (!this.pdfCancelRequested) {
        setTimeout(() => {
          this.pdfExporting.set(false);
          this.pdfProgress.set(0);
        }, 800);
      }
    }
  }

  async printTable(): Promise<void> {
    this.closeExportMenu();
    const cols = this.exportableColumns();
    const rows = await this.getAllDataForExport('all');
    const title = this.config().exportFileName ?? 'Table Data';
    const generatedOn = this.timestampForDisplay();
    const headHtml = cols.map((c) => `<th>${this.escapeHtml(c.label)}</th>`).join('');
    const bodyHtml = rows
      .map(
        (row, idx) =>
          `<tr><td>${idx + 1}</td>${cols.map((col) => `<td>${this.escapeHtml(this.formatExportCell(row, col))}</td>`).join('')}</tr>`,
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page{size:A4 landscape;margin:14mm}
        body{font-family:Arial,sans-serif;padding:12px;color:#111827;position:relative}
        .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.1;width:420px;pointer-events:none;z-index:-1}
        .header-container{display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:18px}
        .logo{position:absolute;left:0;top:0;height:38px;width:auto}
        h2{text-align:center;margin:0 0 4px;color:#1f2937;font-size:16px}
        .subtitle{text-align:center;color:#6b7280;font-size:11px;margin:0}
        table{width:100%;border-collapse:collapse;table-layout:fixed;background:transparent}
        th{background:#f9fafb;text-align:left;border:1px solid #d1d5db;padding:6px 8px;font-size:10px;font-weight:600}
        td{border:1px solid #e5e7eb;padding:6px 8px;font-size:10px;word-break:break-word;background:transparent}
      </style></head><body>
      <img class="watermark" src="/onlyLogo.png" alt="" />
      <div class="header-container">
        <img class="logo" src="/onlyLogo.png" alt="Logo" />
        <div>
          <h2>${this.escapeHtml(title)}</h2>
          <p class="subtitle">Generated on: ${this.escapeHtml(generatedOn)}  •  Rows: ${rows.length}</p>
        </div>
      </div>
      <table><thead><tr><th>S.No</th>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
    </body></html>`;
    const w = window.open('', '_blank', 'width=1200,height=800');
    if (!w) {
      console.warn('Print popup was blocked by the browser.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 300);
    w.addEventListener('afterprint', () => w.close());
  }

  private stripHtml(value: string): string {
    const div = document.createElement('div');
    div.innerHTML = String(value ?? '');
    return div.textContent || div.innerText || '';
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  togglePageSizePopover(): void {
    this.pageSizePopoverOpen.update((v) => !v);
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  toggleSelectAll(): void {
    const rows = this.displayRows().filter((r) => !r.__isGroupHeader);
    const idKey = (this.config().rowIdKey ?? 'id') as string;
    const selectableWhen = this.config().selectableWhen;
    const selectableRows = selectableWhen ? rows.filter((r) => selectableWhen(r)) : rows;
    const allSel =
      selectableRows.length > 0 &&
      selectableRows.every((r) => this.selectedIds().has(String((r as any)[idKey])));
    this.selectedIds.update((set) => {
      const next = new Set(set);
      selectableRows.forEach((r) => {
        const id = String((r as any)[idKey]);
        allSel ? next.delete(id) : next.add(id);
      });
      return next;
    });
    this.emitSelection();
  }

  toggleRow(row: T): void {
    const idKey = (this.config().rowIdKey ?? 'id') as string;
    const id = String((row as any)[idKey]);
    this.selectedIds.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    this.emitSelection();
  }

  isRowSelected(row: T): boolean {
    return this.selectedIds().has(String((row as any)[(this.config().rowIdKey ?? 'id') as string]));
  }

  private emitSelection(): void {
    const idKey = (this.config().rowIdKey ?? 'id') as string;
    this.selectionChange.emit(
      this.displayRows().filter((r) => this.selectedIds().has(String((r as any)[idKey]))),
    );
  }

  // ── Row / Toolbar actions ─────────────────────────────────────────────────
  onRowAction(actionId: string, row: T, event: Event): void {
    event.stopPropagation();
    this.rowAction.emit({ actionId, row });
  }

  onCustomRowAction(action: CustomRowAction<T>, row: T, event: Event): void {
    event.stopPropagation();
    if (action.disabled?.(row)) return;
    action.onClick(row, event);
  }

  onToolbarButtonClick(button: ToolbarButton<T>, event: Event): void {
    event.stopPropagation();
    if (this.isToolbarButtonDisabled(button)) return;
    button.onClick?.(this.selectedRows(), this.allRows());
    this.toolbarButtonClick.emit({
      buttonId: button.id,
      selectedRows: this.selectedRows(),
      allRows: this.allRows(),
    });
  }

  onBulkActionClick(action: BulkAction<T>): void {
    if (this.isBulkActionDisabled(action)) return;
    const rows = this.selectedRows();
    this.closeBulkActionModal();
    action.onClick(rows);
  }

  isBulkActionDisabled = (action: BulkAction<T>): boolean =>
    action.disabled ? action.disabled(this.selectedRows()) : false;

  isBulkActionHidden = (action: BulkAction<T>): boolean =>
    action.hidden ? action.hidden(this.selectedRows()) : false;

  onRowClick(row: T): void {
    if (this.config().clickable) this.rowClick.emit(row);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  isToolbarButtonDisabled = (btn: ToolbarButton<T>): boolean => {
    if (typeof btn.disabled === 'boolean') return btn.disabled;
    if (typeof btn.disabled === 'function') return btn.disabled(this.selectedRows());
    return false;
  };

  isToolbarButtonHidden = (btn: ToolbarButton<T>): boolean => {
    if (typeof btn.hidden === 'boolean') return btn.hidden;
    if (typeof btn.hidden === 'function') return btn.hidden(this.selectedRows());
    return false;
  };

  isCustomActionHidden = (action: CustomRowAction<T>, row: T): boolean =>
    action.hidden ? action.hidden(row) : false;

  isActionHidden(action: RowAction<T>, row: T): boolean {
    return action.hidden ? action.hidden(row) : false;
  }

  getColumnTemplate(key: string) {
    return this.templateMap().get(key);
  }
  getCellValue(row: T, key: any): any {
    return (row as any)?.[key];
  }

  isStickyRight(col: SmartColumn<any>): boolean {
    if (!col.sticky) return false;
    const keyStr = String(col.key).toLowerCase();
    if (keyStr === 'rowactions' || keyStr === 'action' || keyStr === 'actions') return true;
    const visCols = this.visibleColumns();
    if (visCols.length > 0 && visCols[visCols.length - 1].key === col.key) return true;
    return false;
  }

  isStickyLeft(col: SmartColumn<any>): boolean {
    if (!col.sticky) return false;
    return !this.isStickyRight(col);
  }

  getSortIcon(key: keyof T): 'up' | 'down' | 'none' {
    const s = this.sort();
    if (s.key !== key) return 'none';
    return s.dir === 'asc' ? 'up' : 'down';
  }

  trackById(_: number, row: any): any {
    return row?.[this.config().rowIdKey ?? 'id'] ?? _;
  }

  getBadgeClass(col: any, value: any): string {
    // If the column's badgeMap explicitly tags this value with a color
    // (BadgeMapEntry.color), that wins over the generic value->class
    // guess below -- lets a column like call status/direction use
    // domain-specific values (e.g. 'completed', 'inbound') while still
    // rendering with the shared good/warn/danger/info/pink palette.
    const raw = String(value ?? '');
    const entryColor = col?.badgeMap?.[raw]?.color as string | undefined;
    if (entryColor) {
      const colorClassMap: Record<string, string> = {
        good: 'badge-good',
        danger: 'badge-rejected',
        warn: 'badge-pending',
        info: 'badge-interview',
        pink: 'badge-shortlist',
        premium: 'badge-premium',
        default: 'badge-default',
      };
      return colorClassMap[entryColor] ?? 'badge-default';
    }

    switch (raw.toLowerCase()) {
      case 'pending':
        return 'badge-pending';
      case 'selected':
        return 'badge-selected';
      case 'shortlist':
        return 'badge-shortlist';
      case 'interview':
        return 'badge-interview';
      case 'rejected':
        return 'badge-rejected';
      case 'good':
        return 'badge-good';
      case 'excellent':
        return 'badge-excellent';
      case 'neutral':
        return 'badge-neutral';
      case 'risk':
        return 'badge-risk';
      case 'premium':
        return 'badge-premium';
      default:
        return 'badge-default';
    }
  }

  getBadgeLabel(col: SmartColumn<T>, value: unknown): string {
    const map = col.badgeMap;
    if (!map) return String(value ?? '');
    return map[String(value)]?.label ?? String(value ?? '');
  }

  getButtonColorClass = (c?: string) => (c && c !== 'default' ? `st-btn--${c}` : '');
  getActionColorClass = (c?: string) => (c && c !== 'default' ? `st-action-btn--${c}` : '');

  isImage(value: any): boolean {
    return (
      typeof value === 'string' &&
      value.startsWith('http') &&
      /\.(png|jpg|jpeg|webp|gif)/i.test(value)
    );
  }

  formatDateCell(value: any): string {
    if (value === null || value === undefined || value === '' || value === '-' || value === '—') {
      return '-';
    }
    const strVal = String(value).trim();
    if (/^0/.test(strVal) || strVal === '0000-00-00') {
      return '-';
    }
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return strVal;
      }
      const year = d.getFullYear();
      if (year < 1000 || String(year).startsWith('0') || year <= 0) {
        return '-';
      }
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return strVal;
    }
  }

  formatCellValue(value: any): string {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object')
      return Object.entries(value)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    return String(value);
  }

  truncateCellValue(value: any, wordCount = 3): string {
    const text = this.formatCellValue(value).trim();
    if (text.length <= 30) return text;
    return text.slice(0, 30) + '…';
  }

  isCellValueTruncated(value: any): boolean {
    const text = this.formatCellValue(value).trim();
    return text.length > 30;
  }

  isString = (v: unknown): v is string => typeof v === 'string';
  asTemplate = (v: unknown): TemplateRef<unknown> => v as TemplateRef<unknown>;

  // ── Column resize ─────────────────────────────────────────────────────────
  startResize(event: MouseEvent, key: string): void {
    event.preventDefault();
    event.stopPropagation();
    const th = (event.target as HTMLElement).closest('th') as HTMLElement;
    const startX = event.clientX;
    const startW = th.offsetWidth;
    const onMove = (e: MouseEvent) => {
      const newW = Math.max(60, startW + (e.clientX - startX));
      this.colWidths.update((w) => ({ ...w, [key]: newW }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Column reorder ────────────────────────────────────────────────────────
  onDragStart(event: DragEvent, key: string): void {
    this.dragSrcKey.set(key);
    event.dataTransfer!.effectAllowed = 'move';
  }

  onDragEnd(): void {
    this.wasDragging.set(true);
    this.dragSrcKey.set(null);
    this.dragOverKey.set(null);
    setTimeout(() => this.wasDragging.set(false), 0);
  }

  onDragOver(event: DragEvent, key: string): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    if (this.dragSrcKey() !== key) this.dragOverKey.set(key);
  }

  onDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as HTMLElement;
    const th = event.currentTarget as HTMLElement;
    if (!th.contains(related)) this.dragOverKey.set(null);
  }

  onDrop(event: DragEvent, targetKey: string): void {
    event.preventDefault();
    const src = this.dragSrcKey();
    if (!src || src === targetKey) return;
    this.colOrder.update((order) => {
      const next = [...order];
      const from = next.indexOf(src);
      const to = next.indexOf(targetKey);
      if (from === -1 || to === -1) return order;
      next.splice(from, 1);
      next.splice(to, 0, src);
      return next;
    });
    this.dragSrcKey.set(null);
    this.dragOverKey.set(null);
  }
  toggleDropdown(key: string, event?: MouseEvent): void {
    const opening = this.activeDropdownKey() !== key;

    // Close all SingleInput components
    this.singleInputComponents?.forEach((comp) => comp.closeDropdown());

    if (opening && event) {
      const trigger = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.activeDropdownKey.set(key);
      this.dropdownPosition.set({
        top: trigger.bottom + 6,
        left: trigger.left,
        width: trigger.width,
      });
    } else {
      this.activeDropdownKey.set(null);
      this.dropdownPosition.set(null);
    }
  }

  onSingleInputOpened(openedComp: SingleInput): void {
    // Close DataTable custom dropdowns (starRating, multiSelect)
    this.activeDropdownKey.set(null);
    this.dropdownPosition.set(null);

    // Close all OTHER SingleInput components
    this.singleInputComponents?.forEach((comp) => {
      if (comp !== openedComp) {
        comp.closeDropdown();
      }
    });
  }

  isDropdownOpen(key: string): boolean {
    return this.activeDropdownKey() === key;
  }

  closeAllDropdowns(): void {
    this.activeDropdownKey.set(null);
    this.dropdownPosition.set(null);
    this.singleInputComponents?.forEach((comp) => comp.closeDropdown());
  }

  hasSelections(key: string): boolean {
    const values = this.tempFilters()[key];
    return Array.isArray(values) && values.length > 0;
  }

  /**
   * Generates space-efficient label displays like "Hot, VIP +3 more"
   */
  getMultiSelectDisplay(key: string): string {
    const selectedValues = this.tempFilters()[key];
    if (!Array.isArray(selectedValues) || selectedValues.length === 0) {
      return '';
    }

    const filterDef = this.allFilters().find((f) => f.key === key);
    if (!filterDef || !filterDef.options) {
      return `${selectedValues.length} selected`;
    }

    const selectedLabels = selectedValues.map((val) => {
      const option = filterDef.options!.find((o) => o.value === val);
      return option ? option.label : val;
    });

    if (selectedLabels.length <= 2) {
      return selectedLabels.join(', ');
    }

    return `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2} more`;
  }

  /**
   * Placeholder for future server-side / client-side search filtering
   */
  onDropdownSearch(filterKey: string, searchTerm: string): void {
    // Logic to emit an event or filter filter.options dynamically
    console.log(`Searching for '${searchTerm}' in filter: ${filterKey}`);
  }

  // ── Star rating filter helpers ───────────────────────────
  starArray(value: number | string | null | undefined, max = 5): boolean[] {
    const n = Number(value) || 0;
    return Array.from({ length: max }, (_, i) => i < n);
  }

  selectedStarValue(key: string): number {
    return Number(this.tempFilters()[key]) || 0;
  }

  isStarSelected(key: string, value: any): boolean {
    return String(this.tempFilters()[key] ?? '') === String(value);
  }

  selectStarRating(key: string, value: any): void {
    const current = this.tempFilters()[key];
    const next = String(current ?? '') === String(value) ? '' : value;
    this.updateTempFilter(key, next);
    this.activeDropdownKey.set(null);
    this.dropdownPosition.set(null);
  }
  pdfExportableColumns = computed(() =>
    this.config().columns.filter((c) => !this.isColumnExcludedFromExport(c, true)),
  );

  selectAllPdfColumns(): void {
    const limit = this.PAGE_SIZE_LIMITS[this.pdfPageSize()];
    const keys = this.pdfExportableColumns()
      .map((c) => c.key as string)
      .slice(0, limit);
    this.pdfSelectedColumns.set(keys);
  }

  clearPdfColumns(): void {
    this.pdfSelectedColumns.set([]);
  }
}
