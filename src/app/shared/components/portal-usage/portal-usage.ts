import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortalTrend, PortalTrendMetric, PortalTrendPoint, PortalUsageData } from '../../../core/models/client-portal.model';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalCountUp } from '../../count-up.directive';
import { PortalIcon } from '../../portal-icon';

const LEVEL_LABEL = { high: 'Strong adoption', medium: 'Moderate', low: 'Needs attention', neutral: 'This month' } as const;
const CARD_ICON: Record<string, string> = { employee: 'employee', attendance: 'attendance', leave: 'leave' };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** line colours (css classes m0..m2) in the order metrics are plotted */
const SERIES_CLASS = ['m0', 'm1', 'm2'];

/** next "round" even axis maximum for count charts (4, 6, 8, 10, 20, 40, 60, 80, 100, 200 ...) */
function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const nf = [1, 2, 4, 6, 8, 10].find(s => f <= s) ?? 10;
  return Math.max(4, nf * p);
}

/** free-flowing curve: cubic segments with horizontal tangents (smooth, never overshoots the data) */
function curve(p: Array<{ x: number; y: number }>): string {
  return p.reduce((d, q, i) => {
    if (i === 0) return `M${q.x},${q.y}`;
    const a = p[i - 1], mx = (a.x + q.x) / 2;
    return `${d} C${mx},${a.y} ${mx},${q.y} ${q.x},${q.y}`;
  }, '');
}

@Component({
  selector: 'portal-usage',
  standalone: true,
  imports: [CommonModule, PortalIcon, PortalCountUp],
  templateUrl: './portal-usage.html',
  styleUrl: './portal-usage.css',
})
export class PortalUsage implements OnInit {
  private api = inject(ClientPortalService);
  private state = inject(PortalState);

  loading = signal(true);
  error = signal('');
  data = signal<PortalUsageData | null>(null);
  animate = signal(false);
  hover = signal<number | null>(null);

  // ---------- module tabs ----------
  activeTab = signal('');
  trends = signal<Record<string, PortalTrend>>({});
  private loadingTabs = signal<ReadonlySet<string>>(new Set());
  private tabErrors = signal<Record<string, string>>({});
  trendAnimate = signal(false);
  hoverT = signal<number | null>(null);

  tabs = computed(() => this.data()?.tabs ?? []);
  currentTrend = computed(() => this.trends()[this.activeTab()] ?? null);
  trendLoading = computed(() => this.loadingTabs().has(this.activeTab()));
  trendError = computed(() => this.tabErrors()[this.activeTab()] ?? '');
  activeTabLabel = computed(() => this.tabs().find(t => t.key === this.activeTab())?.label ?? '');

  readonly C = 2 * Math.PI * 38;
  readonly skeletons = [1, 2, 3];
  readonly levelLabel = LEVEL_LABEL;

  // ---------- Daily bars (last 30 days) ----------
  readonly DW = 600; readonly DH = 170;
  bars = computed(() => {
    const d = this.data();
    if (!d) return [];
    const max = Math.max(1, d.summary.activeEmployees, ...d.daily.map(x => x.present));
    const slot = this.DW / d.daily.length;
    return d.daily.map((x, i) => {
      const h = x.present > 0 ? Math.max(4, (x.present / max) * this.DH) : 2;
      return { ...x, x: i * slot + slot * 0.18, w: slot * 0.64, h, y: this.DH - h, cx: i * slot + slot / 2, off: x.present === 0 };
    });
  });
  limitY = computed(() => {
    const d = this.data();
    if (!d) return 0;
    const max = Math.max(1, d.summary.activeEmployees, ...d.daily.map(x => x.present));
    return this.DH - (d.summary.activeEmployees / max) * this.DH;
  });
  hovered = computed(() => { const i = this.hover(); return i === null ? null : this.bars()[i] ?? null; });

  // ---------- Trend line chart (day / week / month, any module) ----------
  readonly TW = 600; readonly TH = 190; readonly PAD = 34;
  private tx(i: number, n: number) { return n <= 1 ? this.TW / 2 : this.PAD + (i * (this.TW - this.PAD * 2)) / (n - 1); }
  private ty(v: number, max: number) { return this.TH - 26 - (Math.max(0, Math.min(max, v)) / max) * (this.TH - 46); }

  chart = computed(() => {
    const t = this.currentTrend();
    if (!t || !t.points.length) return null;
    const n = t.points.length;
    const plotted = t.metrics.filter(m => m.plot);
    const val = (p: PortalTrendPoint, m: PortalTrendMetric) => (m.unit === 'pct' ? p.pcts[m.key] : p.values[m.key]) ?? 0;
    const unit = plotted[0]?.unit ?? 'count';
    const peak = Math.max(0, ...plotted.flatMap(m => t.points.map(p => val(p, m))));
    const max = unit === 'pct' ? 100 : niceMax(peak);
    const base = this.TH - 26;

    const lines = plotted.map((m, mi) => {
      const pts = t.points.map((p, i) => ({ x: this.tx(i, n), y: this.ty(val(p, m), max), v: val(p, m) }));
      const line = curve(pts);
      return {
        key: m.key, label: m.label, cls: SERIES_CLASS[mi % SERIES_CLASS.length], pts, line,
        area: mi === 0 && n > 1 ? `${line} L${pts[n - 1].x},${base} L${pts[0].x},${base} Z` : '',
      };
    });

    const suffix = unit === 'pct' ? '%' : '';
    const grid = [0, 0.5, 1].map(f => { const v = Math.round(max * f); return { text: v + suffix, y: this.ty(v, max) }; });

    // x labels: all of them when there are few points, otherwise every k-th one (+ always the last)
    const step = n <= 8 ? 1 : Math.ceil(n / 7);
    const idx: number[] = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) {
      if (n - 1 - idx[idx.length - 1] >= Math.ceil(step / 2)) idx.push(n - 1);
      else idx[idx.length - 1] = n - 1;
    }
    const xl = idx.map(i => ({ x: this.tx(i, n), label: t.points[i].label, cur: t.points[i].current }));

    const slot = n <= 1 ? this.TW - this.PAD * 2 : (this.TW - this.PAD * 2) / (n - 1);
    const hits = t.points.map((_, i) => ({ x: this.tx(i, n) - slot / 2, w: slot }));
    return { lines, grid, xl, hits, n, unit, suffix, empty: peak === 0, showValues: n <= 8, dotR: n > 16 ? 2 : 3 };
  });

  tip = computed(() => {
    const i = this.hoverT(), t = this.currentTrend(), c = this.chart();
    if (i === null || !t || !c) return null;
    const p = t.points[i];
    if (!p) return null;
    const plottedKeys = t.metrics.filter(m => m.plot).map(m => m.key);
    return {
      left: Math.min(86, Math.max(14, (this.tx(i, c.n) / this.TW) * 100)),
      title: this.rowLabel(p, t),
      rows: t.metrics.map(m => ({
        label: m.label,
        text: m.unit === 'pct' ? `${p.values[m.key]} · ${p.pcts[m.key]}%` : `${p.values[m.key]}`,
        cls: plottedKeys.includes(m.key) ? SERIES_CLASS[plottedKeys.indexOf(m.key) % SERIES_CLASS.length] : '',
      })),
      tickets: p.tickets,
    };
  });

  trendTitle = computed(() => {
    const t = this.currentTrend();
    if (!t) return '';
    if (t.granularity === 'day') return 'Daily trend';
    return `${t.months}-month trend`;
  });
  trendSub = computed(() => {
    const t = this.currentTrend();
    if (!t) return '';
    if (t.granularity === 'day') {
      const [y, m] = t.to.split('-');
      return `${t.description} · per day in ${FULL_MONTH_NAMES[+m - 1]} ${y}`;
    }
    const per = t.granularity === 'week' ? 'per week' : 'per month';
    const since = this.sinceLabel();
    return `${t.description} · ${per}${since ? ` · since your plan started in ${since}` : ''}`;
  });

  maxWeekday = computed(() => Math.max(1, ...(this.data()?.weekday.map(w => w.avg) ?? [1])));
  busiestDay = computed(() => {
    const w = (this.data()?.weekday ?? []).filter(x => x.days >= 3);
    return w.length ? w.reduce((a, b) => (b.avg > a.avg ? b : a)).day : '';
  });

  /** "Aug 2026" - only when the plan is younger than 6 months (otherwise the chart is the usual 6-month view) */
  sinceLabel = computed(() => {
    const d = this.data();
    if (!d?.planStart || d.range?.granularity === 'month') return '';
    const [y, m] = d.planStart.split('-');
    return `${MONTH_NAMES[+m - 1]} ${y}`;
  });

  asOf = computed(() => {
    const iso = this.data()?.asOf;
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.animate.set(false);
    this.api.getUsage().subscribe({
      next: (res) => {
        if (res?.status && res.data) {
          this.data.set(res.data);
          this.trends.set(res.data.trends ?? {});
          this.loadingTabs.set(new Set());
          this.tabErrors.set({});
          this.activeTab.set(res.data.defaultTab ?? res.data.tabs?.[0]?.key ?? '');
          this.loading.set(false);
          setTimeout(() => this.animate.set(true), 120);
          this.ensureTrend(this.activeTab());
        } else {
          this.error.set(res?.msg || 'Could not load usage analytics.');
          this.loading.set(false);
        }
      },
      error: () => { this.error.set('Could not load usage analytics. Please try again.'); this.loading.set(false); },
    });
  }

  // ---------- tabs ----------
  selectTab(key: string): void {
    if (key === this.activeTab()) return;
    this.activeTab.set(key);
    this.hoverT.set(null);
    this.ensureTrend(key);
  }

  retryTrend(): void { this.loadTrend(this.activeTab()); }

  private ensureTrend(key: string): void {
    if (!key) return;
    if (this.trends()[key]) this.kickTrendAnimation();
    else if (!this.loadingTabs().has(key)) this.loadTrend(key);
  }

  private loadTrend(key: string): void {
    this.loadingTabs.update(s => new Set(s).add(key));
    this.tabErrors.update(e => ({ ...e, [key]: '' }));
    this.api.getUsageModule(key).subscribe({
      next: (res) => {
        this.loadingTabs.update(s => { const n = new Set(s); n.delete(key); return n; });
        if (res?.status && res.data) {
          this.trends.update(m => ({ ...m, [key]: res.data }));
          if (key === this.activeTab()) this.kickTrendAnimation();
        } else {
          this.tabErrors.update(e => ({ ...e, [key]: res?.msg || 'Could not load this tab.' }));
        }
      },
      error: () => {
        this.loadingTabs.update(s => { const n = new Set(s); n.delete(key); return n; });
        this.tabErrors.update(e => ({ ...e, [key]: 'Could not load this tab. Please try again.' }));
      },
    });
  }

  /** re-play the line "draw" animation whenever another tab's chart is shown */
  private kickTrendAnimation(): void {
    this.trendAnimate.set(false);
    setTimeout(() => this.trendAnimate.set(true), 60);
  }

  // ---------- helpers ----------
  offset(p: number): number { return this.C * (1 - Math.max(0, Math.min(100, p)) / 100); }
  icon(key: string): string { return CARD_ICON[key] ?? 'analytics'; }
  dateLabel(iso: string): string { const [, m, d] = iso.split('-'); return `${+d} ${MONTH_NAMES[+m - 1]}`; }
  insightIcon(t: string): string { return t === 'good' ? 'check' : t === 'info' ? 'info' : 'alert'; }
  contactSupport(): void { this.state.openRaiseTicket(); }

  /** "26 Oct" (day) · "20 Oct – 26 Oct" (week) · "Oct" (month) */
  rowLabel(p: PortalTrendPoint, t: PortalTrend): string {
    if (t.granularity === 'month') return p.label;
    if (t.granularity === 'day' || p.start === p.end) return this.dateLabel(p.start);
    return `${this.dateLabel(p.start)} – ${this.dateLabel(p.end)}`;
  }
  curTag(t: PortalTrend): string { return t.granularity === 'day' ? 'today' : t.granularity === 'week' ? 'this week' : 'so far'; }
  seriesClass(t: PortalTrend, m: PortalTrendMetric): string {
    const i = t.metrics.filter(x => x.plot).findIndex(x => x.key === m.key);
    return i < 0 ? '' : SERIES_CLASS[i % SERIES_CLASS.length];
  }
  reversed(points: PortalTrendPoint[]): PortalTrendPoint[] { return points.slice().reverse(); }
}