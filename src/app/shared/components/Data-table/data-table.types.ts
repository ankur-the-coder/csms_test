// ─────────────────────────────────────────────────────────────────────────────
// data-table.types.ts
// Shared type definitions for the SmartTable component
// ─────────────────────────────────────────────────────────────────────────────

import { TemplateRef } from '@angular/core';

// ── Utility ──────────────────────────────────────────────────────────────────

/** Deep-path accessor: getByPath({ a: { b: 1 } }, 'a.b') → 1 */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc, key) => (acc as any)?.[key], obj);
}

// ── Column ───────────────────────────────────────────────────────────────────

export type ColType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'badge'
  | 'boolean'
  | 'avatar'
  | 'template';

export interface BadgeMapEntry {
  label: string;
  color?: string; // optional extra
}

export interface SmartColumn<T> {
  key: keyof T | string;
  label: string;
  type?: ColType;
  sortable?: boolean;
  hidden?: boolean;
  sticky?: boolean;
  align?: 'left' | 'center' | 'right';
  tooltip?: string;
  allowHtml?: boolean;
  badgeMap?: Record<string, BadgeMapEntry>;
  cellTemplate?: TemplateRef<any>;
}

// ── Sort / Filter ─────────────────────────────────────────────────────────────

export interface SortState<T> {
  key: keyof T | null;
  dir: 'asc' | 'desc';
}

export interface FilterState {
  search: string;
  [key: string]: unknown;
}

export interface TableFilter {
  key: string;
  label: string;
  type?: 'select' | 'multiselect' | 'range' | 'daterange' | 'text';
  options?: { label: string; value: any }[];
  multiSelect?: boolean;
  searchable?: boolean;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type ActionIcon = 'view' | 'edit' | 'delete' | 'download' | 'more';

export interface RowAction<T> {
  id: string;
  icon: ActionIcon;
  label: string;
  color?: 'default' | 'danger' | 'success' | 'warning';
  hidden?: (row: T) => boolean;
}

export interface RowActionEvent<T> {
  actionId: string;
  row: T;
}

export interface CustomRowAction<T> {
  id: string;
  icon?: ActionIcon;
  label: string;
  tooltip?: string;
  color?: string;
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
  onClick: (row: T, event: Event) => void;
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

export type ToolbarButtonType =
  | 'filter'
  | 'refresh'
  | 'export'
  | 'columnPicker'
  | 'datePicker'
  | 'custom';

export interface ToolbarButton<T = any> {
  id: string;
  type: ToolbarButtonType;
  label?: string;
  icon?: string;
  color?: string;
  hidden?: boolean | ((selected: T[]) => boolean);
  disabled?: boolean | ((selected: T[]) => boolean);
  onClick?: (selected: T[], all: T[]) => void;
}

// ── Bulk Actions ──────────────────────────────────────────────────────────────

export interface BulkAction {
  id: string;
  label: string;
}

// ── API Config ────────────────────────────────────────────────────────────────

export interface RequestContext {
  page: number;
  pageSize: number;
  sortKey: string | null;
  sortDir: 'asc' | 'desc';
  search: string;
  filters: Record<string, any>;
  dateFrom: string;
  dateTo: string;
  refresh: () => void;
}

export interface ApiRequest {
  method: 'GET' | 'POST';
  query?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ApiConfig<T> {
  endpoint: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  paramMap?: {
    page?: string;
    pageSize?: string;
    sortKey?: string;
    sortDir?: string;
    search?: string;
  };
  dataPath?: string;
  totalPath?: string;
  buildRequest?: (ctx: RequestContext) => ApiRequest;
  transformRow?: (raw: any) => T;
}

// ── Main Config ───────────────────────────────────────────────────────────────

export interface SmartTableConfig<T> {
  columns: SmartColumn<T>[];
  rowIdKey?: keyof T;

  // Data sources (mutually exclusive)
  staticData?: T[];
  apiConfig?: ApiConfig<T>;

  // Loading
  isLoading?: boolean;
  hasLoaded?: boolean;

  // Pagination
  showPagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];

  // Features
  showSearch?: boolean;
  showFooter?: boolean;
  selectable?: boolean;
  selectableWhen?: (row: T) => boolean;
  clickable?: boolean;
  resizableColumns?: boolean;
  reorderColumns?: boolean;

  // Export
  exportFileName?: string;

  /** In static-data mode: which row field the Date Range filter checks against. */
  dateRangeKey?: string;

  // UI
  emptyMessage?: string;
  groupBy?: keyof T | string;
  groupLabel?: (value: any) => string;

  // Toolbar
  toolbarButtons?: ToolbarButton<T>[];

  // Actions
  customRowActions?: CustomRowAction<T>[];

  // Filters
  filters?: TableFilter[];

  // Bulk actions
  bulkActions?: BulkAction[];
  bulkActionButtonLabel?: string;
  bulkActionButtonIcon?: 'plus' | 'users' | 'check';

  // Search
  searchDebounce?: number;
}