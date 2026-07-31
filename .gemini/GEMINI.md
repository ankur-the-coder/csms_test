
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

---

## Design System (Tailwind v4 — `src/styles.css`)

> **Single source of truth for all visual tokens.** Never hardcode raw colour values in components.
> All tokens are CSS custom properties exposed as Tailwind utilities via `@theme inline`.

### Themes

| Mode | Activation |
|------|-----------|
| Light | Default / `data-mode="light"` on `<html>` |
| Dark  | `data-mode="dark"` on `<html>` |

Dark mode swaps the same token names to dark-palette values — no component changes needed.

---

### Token Reference

#### Brand (emerald — same in both modes)
| Token | Tailwind class | Example use |
|-------|---------------|-------------|
| `--brand-50` … `--brand-900` | `bg-brand-50` … `text-brand-900` | Accent backgrounds, icons, CTAs |

#### Surface (backgrounds / borders)
| Token | Tailwind class | Light value | Dark value |
|-------|---------------|-------------|-----------|
| `--surface-50` | `bg-surface-50` | `#f8fafc` | `#1e293b` |
| `--surface-100` | `bg-surface-100` | `#f1f5f9` | `#1e293b` |
| `--surface-200` | `bg-surface-200` | `#e2e8f0` | `#334155` |
| `--surface-300` | `bg-surface-300` | `#cbd5e1` | `#475569` |

#### Text
| Token | Tailwind class | Use |
|-------|---------------|-----|
| `--text-primary` | `text-text-primary` | Headings, primary labels |
| `--text-secondary` | `text-text-secondary` | Secondary labels |
| `--text-muted` | `text-text-muted` | Timestamps, captions |
| `--text-inverse` | `text-text-inverse` | Text on dark/brand bg |

#### Layout
| Token | Tailwind class | Use |
|-------|---------------|-----|
| `--card-bg` | `bg-card-bg` | Card / panel backgrounds |
| `--card-border` | `border-card-border` | Card borders |
| `--body-bg` | `bg-body-bg` | Page background |
| `--header-bg` | `bg-header-bg` | Top nav bar |
| `--sidebar-bg` | `bg-sidebar-bg` | Side navigation |

#### Status colours (full set per status)
Each status (`success`, `warning`, `danger`, `info`, `neutral`) exposes 5 tokens:

| Suffix | Tailwind class pattern | Use |
|--------|----------------------|-----|
| (base) | `bg-success` / `text-warning` | Solid fills, icon colours |
| `-hover` | `bg-danger-hover` | Hover states |
| `-subtle` | `bg-info-subtle` | Tinted badge / alert backgrounds |
| `-text` | `text-success-text` | Text inside subtle backgrounds |
| `-border` | `border-warning-border` | Badge / alert borders |

---

### Component Classes

Always prefer these pre-built component classes over raw utility chains:

#### Cards
```html
<div class="card">…</div>               <!-- bg-card-bg, border-card-border, rounded-xl, p-6, shadow -->
<div class="card-header">…</div>        <!-- flex items-center justify-between mb-6 -->
<span class="card-title">…</span>       <!-- font-semibold text-text-primary -->
```

#### Stat-card icon containers
```html
<div class="stat-icon stat-icon-brand">…</div>    <!-- brand tint -->
<div class="stat-icon stat-icon-success">…</div>  <!-- success tint -->
<div class="stat-icon stat-icon-warning">…</div>  <!-- warning tint -->
<div class="stat-icon stat-icon-neutral">…</div>  <!-- neutral tint -->
```

#### Badges
```html
<span class="badge badge-brand">Active</span>
<span class="badge badge-success">Completed</span>
<span class="badge badge-warning">In Progress</span>
<span class="badge badge-danger">Risk</span>
<span class="badge badge-info">Info</span>
<span class="badge badge-neutral">Pending</span>
```

#### Progress bar
```html
<div class="progress-track">
  <div class="progress-fill" [style.width.%]="pct"></div>
</div>
```

#### Module badges (compact)
```html
<span class="module-badge module-badge-approved">Employee 3/3</span>
<span class="module-badge module-badge-progress">Leave 1/2</span>
<span class="module-badge module-badge-pending">Payroll 0/5</span>
```

#### Buttons
```html
<button class="btn-primary">Save</button>
<button class="btn-secondary">Cancel</button>
```

#### Filter tabs
```html
<button class="filter-tab"
        [class.filter-tab-active]="active"
        [class.filter-tab-inactive]="!active">All</button>
```

#### Icon buttons (view toggle)
```html
<button class="icon-btn"
        [class.icon-btn-active]="active"
        [class.icon-btn-inactive]="!active">…</button>
```

#### Checkbox (feature toggle)
```html
<button class="check-box"
        [class.check-box-checked]="checked"
        [class.check-box-unchecked]="!checked">…</button>
```

#### Inline text input
```html
<input class="inline-input w-32" placeholder="Remark…" />
```

---

### Rules

1. **Never hardcode colour hex values** in templates or component styles. Use token classes.
2. **Use status tokens** (`success`, `warning`, `danger`, `info`, `neutral`) instead of raw Tailwind colours (`emerald-*`, `amber-*`, `red-*`, `sky-*`, `slate-*`).
3. **All theme changes** go in `src/styles.css` only — one file to re-brand the entire app.
4. **Dark mode** is automatic when `data-mode="dark"` is on `<html>`. No conditional classes needed in components.
