import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { WebRtcVoiceService } from '../../voice.service';
import { Charts, HealthSegment } from '../../../../shared/components/inputs/charts/charts';
import { DatePicker } from '../../../../shared/components/inputs/date-picker/date-picker';
import { CustomButton } from '../../../../shared/components/inputs/custom-button/custom-button';


interface VoiceDashboardData {
  range?: { from: string; to: string };
  kpis: {
    totalCallsToday: number;
    inboundToday: number;
    outboundToday: number;
    answeredCallsCount: number;
    inboundAnsweredCount?: number;
    outboundAnsweredCount?: number;
    missedCallsCount: number;
    inboundMissedCount?: number;
    outboundMissedCount?: number;
    inboundMissedRate?: string;
    outboundMissedRate?: string;
    missedCallRate?: string;
    unansweredRate?: string;
    busyCallsCount: number;
    failedCallsCount: number;
    connectionRate: string;
    avgDuration: string;
    activeCallsNow: number;
  };
  disposition: Array<{ label: string; count: number; color: string }>;
  hourlyVolume: Array<{ hour: string; count: number }>;
}

@Component({
  selector: 'app-voice-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, Charts, DatePicker, CustomButton],
  templateUrl: './voice-dashboard.html',
  styles: [`
    :host {
      display: block;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    /* ── Root wrapper ─────────────────────────── */
    :host .va-root {
      min-height: 100vh;
      background: var(--body-bg);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* ── Charts card: match the minimal card design ── */
    :host ::ng-deep app-charts > div {
      border-radius: 0.75rem;
      border-color: var(--card-border);
      box-shadow: var(--card-shadow);
    }

    :host ::ng-deep app-charts h3 {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.01em;
    }

    /* ── Thinner donut ring: enlarge inner hole ── */
    :host ::ng-deep app-charts .rounded-full > .rounded-full.bg-white {
      width: 7.5rem;
      height: 7.5rem;
      background: var(--card-bg) !important;
    }

    /* ── Legend: single-column layout ── */
    :host ::ng-deep app-charts > div > div:first-child {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    :host ::ng-deep app-charts > div > div:first-child > div:last-child {
      margin-top: auto;
      margin-bottom: auto;
    }
    :host ::ng-deep app-charts > div > div:last-child {
      grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
      row-gap: 0.625rem;
      border-color: var(--card-border);
    }
  `]
})
export class VoiceAnalyticsDashboard implements OnInit {
  private readonly API_BASE = `${environment.apiUrl}/api/voice`;
  readonly stats = signal<VoiceDashboardData | null>(null);
  readonly loading = signal<boolean>(false);

  /** Local YYYY-MM-DD formatter -- avoids UTC-shift bugs from toISOString() on a Date picked in the browser's local timezone. */
  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** From/To filter state -- defaults to "today" on both ends, matching the dashboard's original default range. */
  fromDate = signal<Date>(new Date());
  toDate = signal<Date>(new Date());

  onFromDateChange(date: Date): void {
    this.fromDate.set(date);
  }

  onToDateChange(date: Date): void {
    this.toDate.set(date);
  }

  /** Whether the selected range is exactly today -- used only for the "Today" quick-reset button's active state. */
  get isTodayRange(): boolean {
    const today = this.toDateStr(new Date());
    return this.toDateStr(this.fromDate()) === today && this.toDateStr(this.toDate()) === today;
  }

  /** Caps both pickers at "now" -- no point filtering for calls that haven't happened yet. */
  readonly today: Date = new Date();

  resetToToday(): void {
    const today = new Date();
    this.fromDate.set(today);
    this.toDate.set(today);
    this.loadDashboardData();
  }

  selectDaysAgo(days: number): void {
    const end = new Date();
    const start = new Date();
    if (days > 0) {
      start.setDate(end.getDate() - days);
    }
    this.fromDate.set(start);
    this.toDate.set(end);
    this.loadDashboardData();
  }

  get activePreset(): 'today' | '7d' | '30d' | 'custom' {
    const start = this.toDateStr(this.fromDate());
    const end = this.toDateStr(this.toDate());
    const todayStr = this.toDateStr(new Date());
    if (start === todayStr && end === todayStr) return 'today';

    const d7 = new Date();
    d7.setDate(new Date().getDate() - 7);
    if (start === this.toDateStr(d7) && end === todayStr) return '7d';

    const d30 = new Date();
    d30.setDate(new Date().getDate() - 30);
    if (start === this.toDateStr(d30) && end === todayStr) return '30d';

    return 'custom';
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    this.loading.set(true);
    try {
      const from = this.toDateStr(this.fromDate());
      const to = this.toDateStr(this.toDate());
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`${this.API_BASE}/dashboard-stats?${params.toString()}`);
      const json = await res.json();
      if (json.status && json.data) {
        this.stats.set(json.data);
      }
    } catch (err) {
      console.warn('[VoiceDashboard] Failed to fetch dashboard stats:', err);
    } finally {
      this.loading.set(false);
    }
  }

  /** Max hourly call count (defaults to 5 if all volume is lower) */
  get maxHourlyCount(): number {
    const hourly = this.stats()?.hourlyVolume || [];
    const max = Math.max(...hourly.map(h => h.count), 0);
    return max > 5 ? max : 5;
  }

  /** Below this total-call count, the chart zooms into the active hours instead of showing all 24. */
  private readonly ZOOM_VOLUME_THRESHOLD = 20;
  /** Hours of padding kept on either side of the active window so bars don't hug the edges. */
  private readonly ZOOM_PADDING_HOURS = 2;
  /** Smallest window the zoomed view will ever show, even if activity is a single hour. */
  private readonly ZOOM_MIN_WINDOW_HOURS = 8;

  /** True when call volume is low enough that showing all 24 hours would be mostly dead space. */
  get isZoomedView(): boolean {
    const total = this.stats()?.kpis?.totalCallsToday || 0;
    return total > 0 && total < this.ZOOM_VOLUME_THRESHOLD;
  }

  /** Hourly buckets actually rendered in the chart -- full 24h normally, or a padded window
   *  around the active hours when volume is low enough that the full day is mostly empty. */
  get visibleHourlyVolume(): Array<{ hour: string; count: number }> {
    const hourly = this.stats()?.hourlyVolume || [];
    if (!hourly.length || !this.isZoomedView) return hourly;

    const activeIndices = hourly
      .map((h, i) => (h.count > 0 ? i : -1))
      .filter(i => i !== -1);
    if (!activeIndices.length) return hourly;

    const firstActive = Math.min(...activeIndices);
    const lastActive = Math.max(...activeIndices);

    let start = Math.max(0, firstActive - this.ZOOM_PADDING_HOURS);
    let end = Math.min(hourly.length - 1, lastActive + this.ZOOM_PADDING_HOURS);

    while (end - start + 1 < this.ZOOM_MIN_WINDOW_HOURS && (start > 0 || end < hourly.length - 1)) {
      if (start > 0) start--;
      if (end - start + 1 >= this.ZOOM_MIN_WINDOW_HOURS) break;
      if (end < hourly.length - 1) end++;
    }

    return hourly.slice(start, end + 1);
  }

  getVolumeHeight(count: number): number {
    if (count === 0) return 0;
    return Math.round((count / this.maxHourlyCount) * 100);
  }

  /** Checks if an hourly item represents the peak call volume */
  isPeakBar(item: { hour: string; count: number }): boolean {
    return !!(this.peakHour && item.count > 0 && item.hour === this.peakHour.hour && item.count === this.peakHour.count);
  }

  /** True once dashboard-stats has resolved and the selected range genuinely has zero logged calls — drives the chart's empty state. */
  get hasNoCallsToday(): boolean {
    return !this.loading() && (this.stats()?.kpis?.totalCallsToday || 0) === 0;
  }

  /** Busiest hour bucket today (by call count), for the small badge above the chart. Null when there's no volume yet. */
  get peakHour(): { hour: string; count: number } | null {
    const hourly = this.stats()?.hourlyVolume || [];
    const top = hourly.reduce<{ hour: string; count: number } | null>((best, cur) =>
      cur.count > 0 && (!best || cur.count > best.count) ? cur : best, null);
    return top;
  }

  /** Average calls/hour across the 24 buckets. */
  get avgCallsPerHour(): number {
    const hourly = this.stats()?.hourlyVolume || [];
    if (!hourly.length) return 0;
    const total = hourly.reduce((acc, h) => acc + h.count, 0);
    return total / hourly.length;
  }

  /** Ticks for the Y-axis (from max down to 0) */
  get yAxisTicks(): number[] {
    const max = this.maxHourlyCount;
    if (max <= 6) {
      const ticks = [];
      for (let i = max; i >= 0; i--) ticks.push(i);
      return ticks;
    }
    return [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];
  }

  /** Show label every 2 hours in the full 24h view; every hour once zoomed to a smaller window. */
  shouldShowHourLabel(hour: string): boolean {
    const h = parseInt(hour.split(':')[0], 10);
    const step = this.visibleHourlyVolume.length <= 12 ? 1 : 2;
    return h % step === 0;
  }

  /** Busiest contiguous 5-hour window calculation */
  get busiestTimeRange(): string {
    const hourly = this.stats()?.hourlyVolume || [];
    if (!hourly.length || !this.peakHour) return '09:00 - 14:00';

    const peakIndex = hourly.findIndex(h => h.hour === this.peakHour?.hour);
    if (peakIndex === -1) return '09:00 - 14:00';

    const startIdx = Math.max(0, Math.min(peakIndex - 2, hourly.length - 5));
    const endIdx = Math.min(hourly.length - 1, startIdx + 4);

    const startHour = hourly[startIdx].hour;
    const endHourNum = (parseInt(hourly[endIdx].hour.split(':')[0], 10) + 1) % 24;
    const endHourStr = `${String(endHourNum).padStart(2, '0')}:00`;

    return `${startHour} - ${endHourStr}`;
  }

  /** Percentage of total calls occurring during the peak window */
  get callsInPeakTimePct(): string {
    const hourly = this.stats()?.hourlyVolume || [];
    const total = this.stats()?.kpis?.totalCallsToday || 0;
    if (!hourly.length || total === 0 || !this.peakHour) return '0%';

    const peakIndex = hourly.findIndex(h => h.hour === this.peakHour?.hour);
    if (peakIndex === -1) return '0%';

    const startIdx = Math.max(0, Math.min(peakIndex - 2, hourly.length - 5));
    const endIdx = Math.min(hourly.length - 1, startIdx + 4);

    let windowSum = 0;
    for (let i = startIdx; i <= endIdx; i++) {
      windowSum += hourly[i].count;
    }

    return `${Math.round((windowSum / total) * 100)}%`;
  }

  /** Connection Rate percentage number for progress bar */
  get connectionRatePercent(): number {
    const raw = this.stats()?.kpis?.connectionRate || '0%';
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }

  /** Missed call percentage for Missed Call Rate KPI card */
  get missedCallRatePercent(): number {
    const total = this.stats()?.kpis?.totalCallsToday || 0;
    const missed = this.stats()?.kpis?.missedCallsCount || 0;
    if (total === 0) return 0;
    return Math.round((missed / total) * 100);
  }

  /** Formatted missed call rate string (e.g. "83%") */
  get missedCallRate(): string {
    return `${this.missedCallRatePercent}%`;
  }

  /** True once missed calls cross a bad-enough threshold to warrant visual emphasis on the KPI card. */
  get isMissedRateHigh(): boolean {
    return this.missedCallRatePercent >= 50;
  }

  getDispositionPercent(count: number): number {
    const total = this.stats()?.kpis?.totalCallsToday || 1;
    return Math.round((count / Math.max(total, 1)) * 100);
  }

  private readonly dispositionColorClass: Record<string, string> = {
    Answered: 'bg-success',
    Missed: 'bg-danger',
    Busy: 'bg-warning',
    Failed: 'bg-neutral',
  };

  /** Hex colors for the donut chart — defined here so the chart always matches
   *  the legend regardless of what color the API happens to return.
   *  Mapped to the app's semantic status tokens (styles.css) so this chart
   *  matches every other status badge/indicator in the app. */
  private readonly dispositionColorHex: Record<string, string> = {
    Answered: '#48f7bd',  // success
    Missed: '#fd6969',  // danger
    Busy: '#fdc462',  // warning
    Failed: '#8c9fba',  // neutral
  };

  /** Disposition breakdown reshaped for <app-charts type="donut">. */
  get dispositionSegments(): HealthSegment[] {
    const disposition = this.stats()?.disposition;
    if (!disposition || disposition.length === 0) {
      return [
        { label: 'Answered', value: 0, pct: 0, colorHex: this.dispositionColorHex['Answered'], colorClass: this.dispositionColorClass['Answered'] },
        { label: 'Missed', value: 0, pct: 0, colorHex: this.dispositionColorHex['Missed'], colorClass: this.dispositionColorClass['Missed'] },
        { label: 'Busy', value: 0, pct: 0, colorHex: this.dispositionColorHex['Busy'], colorClass: this.dispositionColorClass['Busy'] },
        { label: 'Failed', value: 0, pct: 0, colorHex: this.dispositionColorHex['Failed'], colorClass: this.dispositionColorClass['Failed'] },
      ];
    }
    return disposition.map(item => ({
      label: item.label,
      value: item.count,
      pct: this.getDispositionPercent(item.count),
      colorHex: this.dispositionColorHex[item.label] ?? item.color,
      colorClass: this.dispositionColorClass[item.label] || 'bg-neutral',
    }));
  }
}
