import { computed, EventEmitter, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, AfterViewInit, Input, OnDestroy, OnInit, NgZone, Output, SimpleChanges, Pipe, PipeTransform, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Chart,
  registerables,
  ChartType,
  ChartData,
  ChartConfiguration,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  PolarAreaController,
  RadialLinearScale,
  ArcElement,
  CategoryScale,

} from 'chart.js';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { ClickOutsideDirective } from '../../../directives/click-outside.directive';





interface ChartTypeOption {
  value: string;
  label: string;
  icon: string;
}
export type CustomChartType = 'bar' | 'line' | 'area' | 'doughnut' | 'radar' | 'polarArea' | 'pie';
 @Component({
  selector: 'app-charts',
  imports: [CommonModule, FormsModule, ClickOutsideDirective],
  templateUrl: './charts.html',
  styleUrl: './charts.css',
})


export class ChartComponent implements OnInit, AfterViewInit, OnDestroy {

  // ---------------------------------------------------------------------
  // SSR / Platform guard.
  // Angular 21 apps use Server-Side Rendering by default. Any method that
  // touches `document`, `window`, or creates a Chart.js instance (which
  // needs a real <canvas>) MUST be skipped when running on the server,
  // otherwise you get: `ReferenceError: document is not defined`.
  // ---------------------------------------------------------------------
  private platformId = inject(PLATFORM_ID);
  private isBrowser: boolean = isPlatformBrowser(this.platformId);

  @ViewChild('chartContainer') chartContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('chartCanvas') chartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private resizeObserver: ResizeObserver | null = null;

 @Input() chartData: number[] = [];
  @Input() chartLabels: string[] = [];
  @Output() onChangeDate: Subject<{ from: string, to: string }> = new Subject()
  @Input() chartType: CustomChartType | ChartType | any = 'bar';
  @Input() hoverLabel: string = '';
  @Input() backgroundColors: string[] = ['', '', '', ''];
  @Input() chartId: string = '';
  @Input() donutCenterText: { line1: string; line2: string; line3: string } = {
    line1: '',
    line2: '',
    line3: '',
  };
  @Input() headingText: string = '';
  @Input() xAxisTitle: string = '';
  @Input() yAxisTitle: string = '';
  @Input() leaveChart:boolean = false;
 
  @Input() sort:boolean = false;
  @Input() groupedData: number[][] = []; // For [[1,2], [4,6], [1,9]] format
@Input() groupColors: string[] = []; // Colors for each position in group
@Input() groupLabels: string[] = []; // Labels that repeat for each group
@Input() isLoading: boolean = false;
@Input() hasError: boolean = false;

  isDropdownOpen = false;
  selectedChart: ChartTypeOption | null = null;
  sanitizedIcons: { [key: string]: SafeHtml } = {};
  private themeObserver: MutationObserver | null = null;
  private isDarkMode: boolean = false;
  isExportDropdownOpen = false;
  public fullChartData: number[] = [];
 private fullChartLabels: string[] = [];
 private isFullscreenMode: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
    // Guard: `createChart()` touches `document` and Chart.js — never run on the server.
    if (!this.isBrowser) {
      return;
    }

    if (
      changes['chartData'] ||
      changes['chartLabels'] ||
      changes['chartType'] ||
      changes['backgroundColors'] ||
      changes['hoverLabel'] ||
      changes['xAxisTitle'] ||
      changes['yAxisTitle']
    ) {
      this.filterTopData(); 
      this.updateChart();
    }
  }


private filterTopData(): void {
  if (this.chartType === 'groupedBar') {
    return;
  }
  
  // CRITICAL: Always clear cached data when in normal mode (not fullscreen)
  if (!this.isFullscreenMode) {
    // Reset the cache first
    this.fullChartData = [];
    this.fullChartLabels = [];
    
    // Now check if we need to filter
    if (this.chartData.length > 5 && this.sort) {
      // Store original data
      this.fullChartData = [...this.chartData];
      this.fullChartLabels = [...this.chartLabels];
      
      // Create array with values, labels, and original indices
      const dataWithIndices = this.chartData.map((value, index) => ({
        value,
        label: this.chartLabels[index],
        color: this.backgroundColors[index],
        originalIndex: index
      }));
      
      // Sort by value (highest to lowest) and take top 5
      const top5 = dataWithIndices
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      
      // Update chart data with top 5
      this.chartData = top5.map(item => item.value);
      this.chartLabels = top5.map(item => item.label);
      // this.backgroundColors = top5.map(item => item.color);
    }
  } 
  // Only restore when explicitly in fullscreen mode
  else if (this.fullChartData.length > 0) {
    this.chartData = [...this.fullChartData];
    this.chartLabels = [...this.fullChartLabels];
  }
}
  private currentFullscreenChart: {
    chart: any;
    overlay: HTMLElement;
    cleanup: () => void;
  } | null = null;
  

  private updateChart(): void {
  if (!this.isBrowser) {
    return;
  }

  // Grouped bar uses its own builder.
  if (this.chartType === 'groupedBar' && this.groupedData.length > 0) {
    this.rebuildGroupedBarWithAnimation();
    return;
  }

  const hasData = Array.isArray(this.chartData) && this.chartData.length > 0;
  const targetData = hasData ? [...this.chartData] : [0, 0, 0, 0, 0];
  const targetLabels = this.chartLabels?.length
    ? [...this.chartLabels]
    : [' ', ' ', ' ', ' ', ' '];

  // First render: create an empty chart and then animate to the real values.
  if (!this.myChart) {
    this.createChart(true);
    return;
  }

  const expectedType = this.isAreaChart()
    ? 'line'
    : (this.chartType === 'groupedBar' ? 'bar' : this.chartType);
  const existingType = String((this.myChart.config as any).type);

  // Changing Bar -> Pie, Pie -> Doughnut, etc. requires a new controller.
  // Always start the new chart from zero so the entrance animation is visible.
  if (existingType !== expectedType) {
    this.myChart.destroy();
    this.myChart = null;

    requestAnimationFrame(() => {
      if (this.isBrowser && !this.myChart) {
        this.createChart(true);
      }
    });
    return;
  }

  // Same chart type (for example, date/filter changed).
  // Do NOT simply assign the new values and call update once: depending on
  // Angular's change-detection timing the browser can paint the final state
  // immediately. First animate to zero, then animate zero -> new values.
  this.myChart.data.labels = targetLabels;

  if (this.myChart.data.datasets?.[0]) {
    this.myChart.data.datasets[0].data = targetData.map(() => 0) as any;
    this.myChart.data.datasets[0].label = this.hoverLabel;
  }

  this.myChart.update();

  requestAnimationFrame(() => {
    if (!this.myChart) {
      return;
    }

    this.myChart.data.labels = targetLabels;
    if (this.myChart.data.datasets?.[0]) {
      this.myChart.data.datasets[0].data = targetData as any;
      this.myChart.data.datasets[0].label = this.hoverLabel;
    }

    this.myChart.update();
  });
}

/**
 * Creates a normal Chart.js chart with a guaranteed entrance animation.
 * When animateFromZero=true the chart is initially rendered with zero values,
 * then the real values are supplied on the next animation frame.
 */
private createChart(animateFromZero: boolean = false): void {
  if (!this.isBrowser) {
    return;
  }

  if (this.chartType === 'groupedBar' && this.groupedData.length > 0) {
    this.createGroupedBarChart();
    return;
  }

  // The existing createChart implementation is below. This flag is consumed
  // just before Chart() is created so the initial render can start from zero.
  this.createChartInternal(animateFromZero);
}

private createChartInternal(animateFromZero: boolean = false): void {
  const colors = this.backgroundColors.slice(0, this.chartData.length);
  const isArea = this.isAreaChart();
  const isLine = this.isLineChart();
  const isRadar = this.isRadarChart();

  const isDarkMode = document.documentElement.classList.contains('dark');
  const labelColor = isDarkMode ? 'white' : 'black';

  const getBackgroundColor = () => {
    if (isArea) {
      const firstColor = colors[0] || '#4BC0C0';
      if (firstColor.startsWith('rgba')) return firstColor;
      if (firstColor.startsWith('rgb')) return firstColor.replace('rgb', 'rgba').replace(')', ', 0.2)');
      const hex = firstColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, 0.2)`;
    }
    if (isRadar) return 'rgba(75, 192, 192, 0.2)';
    return colors;
  };

  const getBorderColor = () => {
    if (isArea) {
      const firstColor = colors[0] || '#4BC0C0';
      if (firstColor.startsWith('rgba')) return firstColor.replace(/[\d\.]+\)$/g, '1)');
      if (firstColor.startsWith('rgb')) return firstColor;
      const hex = firstColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgb(${r}, ${g}, ${b})`;
    }
    if (isLine || isRadar) return 'rgb(75, 192, 192)';
    return 'rgba(75, 192, 192, 0.0)';
  };

  const hasData = this.chartLabels && this.chartLabels.length > 0;
  const labels = hasData ? [...this.chartLabels] : [' ', ' ', ' ', ' ', ' '];
  const realData = hasData ? [...this.chartData] : [0, 0, 0, 0, 0];
  const initialData = animateFromZero ? realData.map(() => 0) : realData;

  const data: ChartData = {
    labels,
    datasets: [{
      label: this.hoverLabel,
      data: initialData,
      backgroundColor: getBackgroundColor(),
      borderColor: getBorderColor(),
      borderWidth: isArea || this.chartType === 'line' ? 2 : 1,
      fill: isArea || isRadar ? 'origin' : false,
      tension: isArea ? 0.4 : 0,
      borderRadius: this.chartType === 'bar' ? { topLeft: 10, topRight: 10 } : undefined,
    }],
  };

  const baseAnimation = {
    duration: 900,
    easing: 'easeOutQuart' as const,
  };

  const config: ChartConfiguration = {
    type: isArea ? 'line' : (this.chartType === 'groupedBar' ? 'bar' : this.chartType),
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: baseAnimation,
      transitions: {
        active: {
          animation: baseAnimation,
        },
      },
      plugins: {
        legend: {
          display: !['bar', 'line'].concat(isArea ? ['area'] : []).includes(this.chartType),
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 6,
            boxHeight: 6,
            color: labelColor,
            padding: 10,
          },
        },
        tooltip: { enabled: hasData },
      },
      scales: (this.chartType === 'bar' || isArea || this.chartType === 'line') ? {
        x: {
          title: {
            display: !!this.xAxisTitle,
            text: this.xAxisTitle,
            font: { size: 10, weight: 'bold' },
          },
          ticks: { color: labelColor },
          grid: { color: isDarkMode ? '#333' : '#ddd' },
        },
        y: {
          beginAtZero: true,
          suggestedMin: 0,
          suggestedMax: 1,
          title: {
            display: !!this.yAxisTitle,
            text: this.yAxisTitle,
            color: labelColor,
            font: { size: 10, weight: 'bold' },
          },
          ticks: { color: labelColor },
          grid: { color: isDarkMode ? '#333' : '#ddd' },
        },
      } : undefined,
      elements: {
        point: { radius: 5 },
        line: { tension: isArea ? 0.4 : 0 },
      },
      ...(this.chartType === 'doughnut' || this.chartType === 'pie' ? {
        cutout: this.chartType === 'doughnut' ? '65%' : 0,
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1000,
          easing: 'easeOutQuart',
        } as any,
      } : {}),
      ...(this.chartType === 'polarArea' ? {
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1000,
          easing: 'easeOutQuart',
        } as any,
        scales: { r: { beginAtZero: true } },
      } : {}),
    },
    plugins: this.chartType === 'doughnut' ? [this.donutTextPlugin()] : [],
  };

  if (this.myChart) {
    this.myChart.destroy();
    this.myChart = null;
  }

  const canvas = this.chartCanvasRef?.nativeElement ||
    (document.getElementById(this.chartId) as HTMLCanvasElement);

  if (!canvas) {
    return;
  }

  this.myChart = new Chart(canvas, config);

  // This is the critical part: the first frame contains zero values, and the
  // second frame receives the real values. This makes the animation visible
  // even when the chart is created after a date/type change.
  if (animateFromZero && hasData) {
    requestAnimationFrame(() => {
      if (!this.myChart) return;

      this.myChart.data.labels = [...this.chartLabels];
      if (this.myChart.data.datasets?.[0]) {
        this.myChart.data.datasets[0].data = [...this.chartData] as any;
      }
      this.myChart.update();
    });
  }
}

private rebuildGroupedBarWithAnimation(): void {
  if (!this.isBrowser) return;

  if (this.myChart) {
    this.myChart.destroy();
    this.myChart = null;
  }

  requestAnimationFrame(() => {
    if (!this.isBrowser) return;
    this.createGroupedBarChart();
  });
}


  chartTypes: ChartTypeOption[] = [
    {
      value: 'bar',
      label: 'Bar Chart',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
  <path d="M18 20V10H22V20H18ZM12 20V4H16V20H12ZM6 20V14H10V20H6Z"/>
</svg>`,
    },
    {
      value: 'line',
      label: 'Line Chart',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
  <polyline points="2 19 6 13 10 15 14 9 18 11 22 5" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M2 19h20" fill="none" stroke="currentColor" stroke-width="2" />
</svg>
`,
    },
    {
      value: 'area',
      label: 'Area Chart',
      icon: `<svg  viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"  width="20" height="20">
<path fill-rule="evenodd" clip-rule="evenodd" d="M4 4C4.55228 4 5 4.44772 5 5V11.5858L7.29289 9.29289C7.59725 8.98853 8.06222 8.91308 8.44721 9.10557L11.6576 10.7108L15.1679 5.4453C15.4477 5.02568 15.9961 4.88003 16.4472 5.10557L20.4472 7.10557C20.786 7.27496 21 7.62123 21 8V19C21 19.5523 20.5523 20 20 20H4C3.44772 20 3 19.5523 3 19V14.0002C3 14.0001 3 13.9999 3 13.9998V5C3 4.44772 3.44772 4 4 4ZM5 14.4142V18H19V8.61803L16.3424 7.28922L12.8321 12.5547C12.5523 12.9743 12.0039 13.12 11.5528 12.8944L8.19745 11.2168L5 14.4142Z" fill="currentColor"/>
</svg>
`,
    },
    {
      value: 'pie',
      label: 'Pie Chart',
      icon: `<svg  viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg"  width="20" height="20" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns">
    
    <title>pie-chart</title>
    <desc>Created with Sketch Beta.</desc>
    <defs>

</defs>
    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage" >
        <g id="Icon-Set" sketch:type="MSLayerGroup" transform="translate(-516.000000, -151.000000)" fill="#000000">
            <path d="M544.551,172.613 L531,168 L531,153 C538.779,152.961 545.889,159.682 545.889,167.571 C545.889,169.629 545.351,171.19 544.551,172.613 L544.551,172.613 Z M530.5,181 C523.597,181 518,175.404 518,168.5 C518,162.21 522.917,156.878 529,156 L529,169.429 L541.709,173.855 C540.018,178.128 535.163,181 530.5,181 L530.5,181 Z M531,151 L529,151 L529,154 C521.721,154.789 516,161.026 516,168.5 C516,176.508 522.492,183 530.5,183 C536.406,183 541.479,179.463 543.738,174.397 L546,175 C547.093,173.205 548,170.657 548,167.571 C548,158.419 540.005,151 531,151 L531,151 Z" id="pie-chart" sketch:type="MSShapeGroup">

</path>
        </g>
    </g>
</svg>

`,
    },
    {
      value: 'doughnut',
      label: 'Doughnut Chart',
      icon: `<svg  viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"  width="20" height="20">
<path d="M0 7.49996C0 3.52583 3.09098 0.27365 7 0.0163574V4.0354C5.30385 4.27801 4 5.73672 4 7.49996C4 9.43295 5.567 11 7.5 11C8.28618 11 9.01181 10.7407 9.5961 10.3031L12.438 13.1451C11.1188 14.3 9.39113 15 7.5 15C3.35786 15 0 11.6421 0 7.49996Z" fill="#000000"/>
<path d="M13.1451 12.438C14.3001 11.1187 15 9.39107 15 7.49996C15 6.46644 14.7909 5.48175 14.4128 4.58586L10.7552 6.21147C10.9132 6.61024 11 7.04496 11 7.49996C11 8.28611 10.7408 9.01174 10.3032 9.59602L13.1451 12.438Z" fill="#000000"/>
<path d="M8 4.0354V0.0163574C10.5416 0.183645 12.7373 1.61699 13.9626 3.69166L10.2541 5.33986C9.71063 4.64791 8.91203 4.16585 8 4.0354Z" fill="#000000"/>
</svg>
`,
    },
    {
      value: 'radar',
      label: 'Radar Chart',
      icon: `<svg fill="#000000" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
	 width="20px" height="20px" viewBox="0 0 96.946 96.946"
	 xml:space="preserve">
<g>
	<path d="M48.473,2.372L0,37.591l18.515,56.984h59.917l18.515-56.984L48.473,2.372z M49.023,6.642L92.48,38.214l-11.082,2.488
		c-0.352-0.85-1.188-1.451-2.166-1.451c-0.203,0-0.396,0.035-0.584,0.082L50.749,15.828c0.042-0.176,0.07-0.357,0.07-0.545
		c0-1.105-0.767-2.025-1.796-2.273V6.642z M64.893,77.723l-37.174,4.783c-0.079-0.162-0.177-0.312-0.29-0.451l6.233-9.592
		c0.235,0.078,0.483,0.131,0.745,0.131c1.296,0,2.347-1.051,2.347-2.346c0-0.002,0-0.004,0-0.004l19.603-4.85
		c0.408,0.69,1.152,1.16,2.013,1.16c0.338,0,0.657-0.074,0.946-0.203l6.267,9.641c-0.429,0.426-0.694,1.014-0.694,1.664
		C64.887,77.68,64.893,77.703,64.893,77.723z M34.354,44.817c-0.049-0.232-0.14-0.447-0.251-0.648l12.857-9.34
		c0.275,0.232,0.6,0.406,0.962,0.494v12.531L34.354,44.817z M47.645,48.92L35.212,68.053c-0.139-0.051-0.283-0.088-0.433-0.113
		l-1.927-20.438c0.708-0.256,1.252-0.838,1.458-1.568L47.645,48.92z M46.127,33.048c0,0.318,0.064,0.619,0.179,0.895l-12.947,9.408
		c-0.372-0.248-0.818-0.395-1.298-0.395c-0.761,0-1.431,0.367-1.859,0.93l-10.725-2.4c-0.025-0.109-0.059-0.215-0.099-0.316
		l28.167-23.732c0.121,0.051,0.248,0.088,0.377,0.121v13.217C46.894,31.022,46.127,31.942,46.127,33.048z M19.452,42.608l10.3,2.307
		c-0.021,0.127-0.039,0.254-0.039,0.387c0,1.191,0.892,2.166,2.042,2.316l1.924,20.41c-0.938,0.307-1.621,1.18-1.621,2.221
		c0,0.636,0.255,1.209,0.665,1.632l-6.172,9.497c-0.123-0.053-0.253-0.094-0.386-0.125l-7.472-37.453
		C19.059,43.494,19.327,43.081,19.452,42.608z M57.768,61.949l-8.4-12.927l13.302-2.985c0.163,0.494,0.478,0.922,0.901,1.209
		l-4.764,14.662c-0.143-0.026-0.289-0.045-0.438-0.045C58.158,61.863,57.96,61.897,57.768,61.949z M60.188,65.672
		c0.324-0.402,0.525-0.908,0.525-1.465c0-0.748-0.355-1.406-0.9-1.836l4.793-14.75c0.093,0.012,0.185,0.027,0.281,0.027
		c1.295,0,2.346-1.051,2.346-2.346c0-0.098-0.018-0.191-0.029-0.287L77.21,42.77c0.196,0.338,0.47,0.619,0.804,0.824L67.692,75.358
		c-0.149-0.028-0.302-0.047-0.46-0.047c-0.247,0-0.48,0.05-0.704,0.119L60.188,65.672z M49.023,17.558
		c0.131-0.033,0.258-0.07,0.379-0.121l27.652,23.297c-0.106,0.268-0.17,0.559-0.17,0.865c0,0.039,0.01,0.076,0.012,0.113
		l-10.078,2.264c-0.422-0.613-1.131-1.018-1.932-1.018c-0.48,0-0.927,0.145-1.299,0.393l-12.947-9.408
		c0.113-0.275,0.179-0.576,0.179-0.895c0-1.105-0.767-2.025-1.796-2.273V17.558L49.023,17.558z M49.023,35.324
		c0.363-0.088,0.688-0.262,0.963-0.494l12.857,9.342c-0.129,0.232-0.222,0.484-0.267,0.758l-13.554,3.043V35.324L49.023,35.324z
		 M56.797,62.477c-0.474,0.431-0.775,1.043-0.775,1.73c0,0.045,0.011,0.088,0.013,0.131l-19.552,4.838
		c-0.096-0.186-0.213-0.356-0.354-0.512L48.473,49.67L56.797,62.477z M47.922,6.642v6.367c-1.028,0.248-1.795,1.168-1.795,2.273
		c0,0.188,0.028,0.369,0.07,0.545L17.8,39.752c-0.194-0.053-0.395-0.09-0.606-0.09c-0.747,0-1.405,0.355-1.834,0.9L4.562,38.145
		L47.922,6.642z M3.78,39.101l11.109,2.486c-0.025,0.137-0.042,0.277-0.042,0.422c0,1.109,0.771,2.033,1.805,2.277l7.47,37.441
		c-0.518,0.43-0.855,1.07-0.855,1.797c0,0.688,0.3,1.299,0.77,1.729l-3.507,5.395L3.78,39.101z M21.326,91.447l3.68-5.664
		c0.194,0.053,0.396,0.09,0.607,0.09c0.894,0,1.662-0.506,2.058-1.241l38.407-4.941c0.342,0.195,0.732,0.316,1.154,0.316
		c0.3,0,0.584-0.062,0.848-0.164l7.541,11.604H21.326z M76.417,90.647l-7.435-11.438c0.367-0.416,0.596-0.952,0.596-1.551
		c0-0.291-0.061-0.567-0.156-0.826l10.75-33.086c0.768-0.336,1.312-1.076,1.387-1.951l11.576-2.6L76.417,90.647z"/>
</g>
</svg>
`,
    },
    {
      value: 'polarArea',
      label: 'Polar Chart',
      icon: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg"  width="20" height="20"
            viewBox="0 0 512.000000 512.000000"
            preserveAspectRatio="xMidYMid meet">

           <g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
           fill="#000000" stroke="none">
           <path d="M2445 4600 c-179 -25 -295 -52 -470 -111 -520 -173 -981 -528 -1289
-994 -40 -60 -96 -153 -124 -205 -53 -99 -142 -302 -142 -324 0 -7 30 -22 68
-33 37 -12 546 -177 1131 -367 585 -190 1070 -346 1077 -346 12 0 14 192 14
1200 l0 1200 -67 -1 c-38 -1 -126 -9 -198 -19z"/>
<path d="M2850 3195 c0 -655 3 -975 10 -975 6 0 378 120 828 266 449 147 861
280 915 297 60 19 97 35 97 44 0 7 -22 62 -49 122 -242 542 -709 955 -1276
1130 -93 29 -284 69 -365 76 -36 3 -86 8 -112 11 l-48 5 0 -976z"/>
<path d="M780 2588 c-41 -173 -52 -306 -47 -528 6 -258 31 -394 113 -631 70
-204 199 -433 341 -609 63 -78 277 -291 311 -309 17 -9 72 63 586 771 312 429
568 785 569 791 1 5 -23 18 -53 28 -233 77 -1787 579 -1792 579 -3 0 -16 -42
-28 -92z"/>
<path d="M3382 2241 c-266 -87 -483 -162 -482 -167 0 -11 587 -821 600 -829
14 -8 146 127 202 206 93 129 167 305 199 469 25 130 7 468 -26 476 -6 1 -227
-68 -493 -155z"/>
<path d="M2334 1389 c-414 -570 -436 -602 -418 -616 46 -34 197 -110 286 -144
362 -138 762 -141 1124 -9 97 35 297 135 315 157 9 10 6 22 -15 51 -181 255
-843 1161 -848 1161 -4 1 -204 -270 -444 -600z"/>
</g>
</svg>

`,
    },
    {
      value: 'groupedBar',
      label: 'Grouped Bar Chart',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M6 20V10H10V20H6ZM12 20V4H16V20H12ZM18 20V14H22V20H18Z"/>
      </svg>`
    }
  ];

  myChart: Chart | null = null;

  constructor(private sanitizer: DomSanitizer,
    private ngZone: NgZone
  ) {
    // Chart.register / DomSanitizer usage does NOT touch document/window,
    // so it's safe to run on the server as well.
    Chart.register(
      ...registerables,
      LineController,
      LineElement,
      PointElement,
      LinearScale,
      PolarAreaController,
      RadialLinearScale,
      ArcElement,
      CategoryScale
    );

    // Sanitize SVG icons and store them separately
    this.chartTypes.forEach((type) => {
      this.sanitizedIcons[type.value] = this.sanitizer.bypassSecurityTrustHtml(
        type.icon
      );
    });

    // Set initial selected chart
    this.selectedChart =
      this.chartTypes.find((type) => type.value === this.chartType) ||
      this.chartTypes[0];
  }

  getSanitizedIcon(value: string): SafeHtml {
    return this.sanitizedIcons[value];
  }
  applyDate(event: { from: string; to: string }) {
    // console.log(event)
    this.onChangeDate.next(event)
  }
  ngOnInit() {
    // Guard: setupThemeObserver() touches `document`.
    if (!this.isBrowser) {
      return;
    }
    this.setSelectedChartType();
    this.setupThemeObserver();
    // Initialize theme immediately
    this.isDarkMode = document.documentElement.classList.contains('dark');
  }

  private setupThemeObserver(): void {
    // Guard: MutationObserver + document don't exist on the server.
    if (!this.isBrowser) {
      return;
    }

    // Initial theme check
    this.isDarkMode = document.documentElement.classList.contains('dark');
  
    // Create observer for theme changes
    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const newIsDarkMode = document.documentElement.classList.contains('dark');
          if (this.isDarkMode !== newIsDarkMode) {
            this.isDarkMode = newIsDarkMode;
            // Use NgZone to ensure proper change detection
            this.ngZone.run(() => {
              this.updateChartTheme();
              this.updateChart(); // Add this to ensure title color is updated
            });
          }
        }
      });
    });
  
    // Start observing theme changes
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private updateChartTheme(): void {
    // Guard: reads `document.documentElement` and touches the Chart.js instance.
    if (!this.isBrowser) {
      return;
    }

    if (this.myChart) {
      const labelColor = this.isDarkMode ? 'white' : 'black';
  
      // Update legend labels color
      if (this.myChart.options.plugins?.legend?.labels) {
        this.myChart.options.plugins.legend.labels.color = labelColor;
      }
  
      // Update scales color if they exist
      const scales = this.myChart.options.scales as { [key: string]: any };
  
      if (scales?.['x']) {
        if (scales['x'].title) {
          scales['x'].title.color = labelColor;
        }
        scales['x'].ticks = {
          ...(scales['x'].ticks || {}),
          color: labelColor
        };
        scales['x'].grid = {
          ...(scales['x'].grid || {}),
          color: this.isDarkMode ? '#333' : '#ddd'
        };
      }
  
      if (scales?.['y']) {
        // Explicitly update the y-axis title color
        if (scales['y'].title) {
          scales['y'].title.color = labelColor;
        }
        scales['y'].ticks = {
          ...(scales['y'].ticks || {}),
          color: labelColor
        };
        scales['y'].grid = {
          ...(scales['y'].grid || {}),
          color: this.isDarkMode ? '#333' : '#ddd'
        };
      }
  
      // Force chart update
      this.myChart.update();
    }
  }

  setSelectedChartType() {
    // Find the default chart based on the provided chartType
    this.selectedChart = this.chartTypes.find((type) => type.value === this.chartType) || this.chartTypes[0];
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.isExportDropdownOpen = false;
    }
  }

  onClickOutside() {
    this.isDropdownOpen = false;
  }

  selectChart(chart: ChartTypeOption): void {
    if (!this.isBrowser) return;

    this.selectedChart = chart;
    this.isDropdownOpen = false;

    const nextChartType = chart.value as CustomChartType | ChartType;
    if (this.chartType === nextChartType) return;

    this.chartType = nextChartType;

    // Do the rebuild here instead of relying on ngOnChanges. This guarantees
    // the dropdown action itself starts the animation.
    if (this.myChart) {
      this.myChart.destroy();
      this.myChart = null;
    }

    requestAnimationFrame(() => {
      if (this.isBrowser && !this.myChart) {
        this.createChart(true);
      }
    });
  }

  onChartTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const nextChartType = target.value as CustomChartType | ChartType;

    if (this.chartType === nextChartType) return;

    this.chartType = nextChartType;

    if (this.myChart) {
      this.myChart.destroy();
      this.myChart = null;
    }

    requestAnimationFrame(() => {
      if (this.isBrowser && !this.myChart) {
        this.createChart(true);
      }
    });
  }


  ngAfterViewInit(): void {
    // Guard: createChart() needs a real <canvas> in the DOM.
    if (!this.isBrowser) {
      return;
    }
    setTimeout(() => {
      this.createChart();
    }, 0);

    if (typeof ResizeObserver !== 'undefined' && this.chartContainerRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            if (this.myChart) {
              // this.myChart.resize();
            } else {
              this.createChart();
            }
          }
        }
      });
      this.resizeObserver.observe(this.chartContainerRef.nativeElement);
    }

    window.addEventListener('resize', this.handleWindowResize);
  }

  private handleWindowResize = (): void => {
    if (this.myChart) {
      this.myChart.resize();
    }
  };

  private isAreaChart(): boolean {
    return (
      this.chartTypes.find((type) => type.value === 'area')?.value ===
      this.chartType
    );
  }

  private isLineChart(): boolean {
    return this.chartTypes.find((type) => type.value === 'line')?.value === this.chartType;
  }

  private isRadarChart(): boolean {
    return this.chartTypes.find((type) => type.value === 'radar')?.value === this.chartType;
  }


  donutTextPlugin() {
    return {
      id: 'donutText',
      beforeDraw: (chart: any) => {
        if (chart.config.type === 'doughnut' && this.donutCenterText) {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;

          ctx.save();
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';

          // Check if the dark mode is enabled by checking the class on the document's body
          const isDarkMode = document.documentElement.classList.contains('dark');
          ctx.fillStyle = isDarkMode ? 'white' : 'black';

          ctx.font = 'bold 35px sans-serif';
          const firstLine = this.donutCenterText.line1 || '';
          ctx.fillText(firstLine, centerX, centerY - 12);

          ctx.font = 'bold 12px sans-serif';
          const secondLine = this.donutCenterText.line2 || '';
          ctx.fillText(secondLine, centerX, centerY + 12);

          ctx.font = 'bold 12px sans-serif';
          const thirdLine = this.donutCenterText.line3 || '';
          ctx.fillText(thirdLine, centerX, centerY + 28);

          ctx.restore();
        }
      },
    };
  }


  toggleExportDropdown() {
    this.isExportDropdownOpen = !this.isExportDropdownOpen;
    if (this.isExportDropdownOpen) {
      this.isDropdownOpen = false;
    }
  }

  onExportClickOutside() {
    this.isExportDropdownOpen = false;
  }

  // Create high-resolution chart for export
  

  // High resolution donut text plugin
  donutTextPluginHighRes() {
    return {
      id: 'donutTextHighRes',
      beforeDraw: (chart: any) => {
        if (chart.config.type === 'doughnut' && this.donutCenterText) {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;

          ctx.save();
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';

          const isDarkMode = document.documentElement.classList.contains('dark');
          ctx.fillStyle = isDarkMode ? 'white' : 'black';

          ctx.font = 'bold 120px sans-serif';
          const firstLine = this.donutCenterText.line1 || '';
          ctx.fillText(firstLine, centerX, centerY - 40);

          ctx.font = 'bold 40px sans-serif';
          const secondLine = this.donutCenterText.line2 || '';
          ctx.fillText(secondLine, centerX, centerY + 40);

          ctx.font = 'bold 40px sans-serif';
          const thirdLine = this.donutCenterText.line3 || '';
          ctx.fillText(thirdLine, centerX, centerY + 100);

          ctx.restore();
        }
      },
    };
  }


  private getHighResChartConfig(width: number = 7680, height: number = 5760, forceWhite: boolean = false, forFullscreen: boolean = false): any {
    if (this.chartType === 'groupedBar') {
      return this.getGroupedBarConfig(width, height, forceWhite, forFullscreen);
    }
    const colors = this.backgroundColors.slice(0, this.chartData.length);
    const isArea = this.isAreaChart();
    const isLine = this.isLineChart();
    const isRadar = this.isRadarChart();
    
    // Force white background and black labels for export if requested
    const isDarkMode = forceWhite ? false : document.documentElement.classList.contains('dark');
    const labelColor = forceWhite ? 'black' : (isDarkMode ? 'white' : 'black');
    
    // Calculate font sizes based on canvas size
    const headingFontSize = Math.max(Math.round(height * 0.035), 18);
    const axisTitleFontSize = Math.max(Math.round(height * 0.025), 14);
    const tickFontSize = Math.max(Math.round(height * 0.018), 12);
    const legendFontSize = Math.max(Math.round(height * 0.022), 14);
    
    const getBackgroundColor = () => {
      if (isArea) {
        const firstColor = colors[0] || '#4BC0C0';
        if (firstColor.startsWith('rgba')) {
          return firstColor;
        } else if (firstColor.startsWith('rgb')) {
          return firstColor.replace('rgb', 'rgba').replace(')', ', 0.2)');
        } else {
          const hex = firstColor.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          return `rgba(${r}, ${g}, ${b}, 0.2)`;
        }
      } else if (isRadar) {
        return 'rgba(75, 192, 192, 0.2)';
      } else {
        return colors;
      }
    };
    
    const getBorderColor = () => {
      if (isArea) {
        const firstColor = colors[0] || '#4BC0C0';
        if (firstColor.startsWith('rgba')) {
          return firstColor.replace(/[\d\.]+\)$/g, '1)');
        } else if (firstColor.startsWith('rgb')) {
          return firstColor;
        } else {
          const hex = firstColor.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          return `rgb(${r}, ${g}, ${b})`;
        }
      } else if (isLine || isRadar) {
        return 'rgb(75, 192, 192)';
      } else {
        return 'rgba(75, 192, 192, 0.0)';
      }
    };
    
    // Add donut center text plugin for doughnut charts
    let extraPlugins: any[] = [];
    if (this.chartType === 'doughnut' && this.donutCenterText) {
      extraPlugins.push(this.getDonutTextPluginForExport(width, height, forceWhite));
    }
    
    return {
     type: isArea ? 'line' : (this.chartType === 'groupedBar' ? 'bar' : this.chartType),
      data: {
        labels: this.chartLabels,
        datasets: [{
          label: this.hoverLabel,
          data: this.chartData,
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: isArea || this.chartType === 'line' ? 3 : 2,
          fill: isArea || isRadar ? 'origin' : false,
          tension: isArea ? 0.4 : 0,
          borderRadius: this.chartType === 'bar' ? {
            topLeft: 10,
            topRight: 10,
          } : undefined,
        }],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: !['bar', 'line'].concat(isArea ? ['area'] : []).includes(this.chartType),
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: legendFontSize,
              boxHeight: legendFontSize,
              color: labelColor,
              padding: Math.round(legendFontSize * 1.2),
              font: {
                size: legendFontSize
              }
            },
          },
          tooltip: {
            enabled: forFullscreen ? true : false,
          },
          title: {
            display: this.convertHtmlToPlainText(this.headingText) ,
            text: this.convertHtmlToPlainText(this.headingText) ,
            color: labelColor,
            font: {
              size: headingFontSize,
              weight: 'bold',
            },
            padding: { top: Math.round(headingFontSize * 0.5), bottom: Math.round(headingFontSize * 0.5) }
          },
        },
        scales: (this.chartType === 'bar' || isArea || this.chartType === 'line') ? {
          x: {
            title: {
              display: !!this.xAxisTitle,
              text: this.xAxisTitle,
              font: {
                size: axisTitleFontSize,
                weight: 'bold',
              },
              color: labelColor,
              padding: Math.round(axisTitleFontSize * 0.5)
            },
            ticks: {
              color: labelColor,
              font: {
                size: tickFontSize
              },
              padding: Math.round(tickFontSize * 0.5)
            },
            grid: {
              color: forceWhite ? '#ddd' : (document.documentElement.classList.contains('dark') ? '#333' : '#ddd'),
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: !!this.yAxisTitle,
              text: this.yAxisTitle,
              color: labelColor,
              font: {
                size: axisTitleFontSize,
                weight: 'bold',
              },
              padding: Math.round(axisTitleFontSize * 0.5)
            },
            ticks: {
              color: labelColor,
              font: {
                size: tickFontSize
              },
              padding: Math.round(tickFontSize * 0.5)
            },
            grid: {
              color: forceWhite ? '#ddd' : (document.documentElement.classList.contains('dark') ? '#333' : '#ddd'),
            },
          },
        } : undefined,
        elements: {
          point: {
            radius: Math.max(Math.round(height * 0.012), 6),
          },
          line: {
            tension: isArea ? 0.4 : 0,
          },
        },
        ...(this.chartType === 'doughnut' ? {
          cutout: '65%',
        } : {}),
        ...(this.chartType === 'polarArea' ? {
          scales: {
            r: {
              beginAtZero: true,
            },
          },
        } : {}),
      },
      plugins: extraPlugins
    };
  }

// 2. Add a new method for export-specific donut text plugin

private getDonutTextPluginForExport(width: number, height: number, forceWhite: boolean = false, forFullscreen: boolean = false): any {
  return {
    id: 'donutTextExport',
    afterDraw: (chart: any) => { // Changed from beforeDraw to afterDraw
      if (chart.config.type === 'doughnut' && this.donutCenterText) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        
        // Add safety check for chartArea
        if (!chartArea || chartArea.width === 0 || chartArea.height === 0) {
          return;
        }
        
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;

        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        // Use appropriate text color
        const isDarkMode = forceWhite ? false : document.documentElement.classList.contains('dark');
        ctx.fillStyle = forceWhite ? 'black' : (isDarkMode ? 'white' : 'black');

        // Scale font sizes based on canvas dimensions
        const baseFontSize = Math.max(Math.round(height * 0.08), 24);
        const smallFontSize = Math.max(Math.round(height * 0.025), 12);
        // Increase line spacing for more margin
        const lineSpacing = Math.max(Math.round(height * 0.09), 40); // was 0.04, now 0.09 for more space
        const bottomSpacing = Math.max(Math.round(height * 0.045), 20); // extra space for third line

        // First line (large text)
        if (this.donutCenterText.line1) {
          ctx.font = `bold ${baseFontSize}px sans-serif`;
          ctx.fillText(this.donutCenterText.line1, centerX, centerY - lineSpacing);
        }

        // Second line (smaller text)
        if (this.donutCenterText.line2) {
          ctx.font = `bold ${smallFontSize}px sans-serif`;
          ctx.fillText(this.donutCenterText.line2, centerX, centerY);
        }

        // Third line (smaller text, more margin below)
        if (this.donutCenterText.line3) {
          ctx.font = `bold ${smallFontSize}px sans-serif`;
          ctx.fillText(this.donutCenterText.line3, centerX, centerY + bottomSpacing);
        }

        ctx.restore();
      }
    },
  };
}

  // View in full screen
viewFullScreen() {
  // Guard: this method builds DOM overlays and canvases directly.
  if (!this.isBrowser) {
    return;
  }

  // Set fullscreen mode and restore full data
  this.isFullscreenMode = true;
  if (this.fullChartData.length > 0) {
    this.chartData = [...this.fullChartData];
    this.chartLabels = [...this.fullChartLabels];
  }

  if(this.sort){ const dataWithIndices = this.chartData.map((value, index) => ({
  value,
  label: this.chartLabels[index]
}));

dataWithIndices.sort((a, b) => b.value - a.value);

this.chartData = dataWithIndices.map(item => item.value);
this.chartLabels = dataWithIndices.map(item => item.label);
  }
  
  const screenWidth = window.screen.width || window.innerWidth;
  const screenHeight = window.screen.height || window.innerHeight;
  
  const overlay = document.createElement('div');
  overlay.id = 'chart-fullscreen-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  `;

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 20px;
    right: 30px;
    background: rgba(255, 255, 255, 0.8);
    border: none;
    font-size: 40px;
    font-weight: bold;
    color: #000;
    cursor: pointer;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.3s;
  `;
  
  closeButton.onmouseover = () => closeButton.style.background = 'rgba(255, 255, 255, 1)';
  closeButton.onmouseout = () => closeButton.style.background = 'rgba(255, 255, 255, 0.8)';

  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    width: 90%;
    height: 85%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  `;

  const canvas = document.createElement('canvas');
  const canvasWidth = Math.min(screenWidth * 0.85, 1920);
  const canvasHeight = Math.min(screenHeight * 0.75, 1080);
  
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.cssText = `
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
  `;

  const fullscreenConfig = this.getHighResChartConfig(
    canvasWidth, 
    canvasHeight, 
    true,
    true
  );

  const closeFullscreen = () => {
    this.isFullscreenMode = false; // Reset fullscreen mode
    this.filterTopData(); // Re-filter to top 6
    this.updateChart(); // Update the original chart
    
    if (fullscreenChart) {
      fullscreenChart.destroy();
    }
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    document.body.style.overflow = '';
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }
  };

  closeButton.onclick = closeFullscreen;
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      closeFullscreen();
    }
  };
  
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeFullscreen();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  canvasContainer.appendChild(canvas);
  overlay.appendChild(closeButton);
  overlay.appendChild(canvasContainer);
  document.body.appendChild(overlay);
  
  document.body.style.overflow = 'hidden';

  let fullscreenChart: any;
  setTimeout(() => {
    try {
      fullscreenChart = new Chart(canvas, fullscreenConfig);
      
      setTimeout(() => {
        if (fullscreenChart && !fullscreenChart.destroyed) {
          fullscreenChart.update('none');
        }
      }, 100);
      
    } catch (error) {
      console.error('Error creating fullscreen chart:', error);
      closeFullscreen();
    }
  }, 50);

  try {
    if (overlay.requestFullscreen) {
      overlay.requestFullscreen().catch(console.error);
    }
  } catch (error) {
    console.log('Fullscreen API not supported or failed:', error);
  }

  const fullscreenChangeHandler = () => {
    if (!document.fullscreenElement && overlay.parentNode) {
      setTimeout(closeFullscreen, 100);
    }
  };
  
  document.addEventListener('fullscreenchange', fullscreenChangeHandler);
  
  this.currentFullscreenChart = {
    chart: fullscreenChart,
    overlay: overlay,
    cleanup: () => {
      document.removeEventListener('fullscreenchange', fullscreenChangeHandler);
      document.removeEventListener('keydown', escHandler);
    }
  };
}



  // Print chart
  printChart() {
    // Guard: DOM/canvas/printing only make sense in the browser.
    if (!this.isBrowser) {
      return;
    }

    const width = 1122;
    const height = 793;
    const hoverLabel = this.hoverLabel;
  
    const chartConfig = this.getHighResChartConfig(width, height, true, false);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
  
    const printConfig = {
      ...chartConfig,
      plugins: [
        ...(chartConfig.plugins || []),
        {
          id: 'printWhiteBackground',
          beforeDraw: (chart: any) => {
            const ctx = chart.ctx;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
          }
        }
      ]
    };
  
    const tempChart = new Chart(tempCanvas, printConfig);
  
    setTimeout(() => {
      const chartImageData = tempCanvas.toDataURL('image/png', 1.0);
  
      // Create print container
      const printContainer = document.createElement('div');
      printContainer.id = 'print-container';
      printContainer.innerHTML = `
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 0.5in;
            }
            body * {
              visibility: hidden !important;
            }
            #print-container, #print-container * {
              visibility: visible !important;
            }
            #print-container {
              position: absolute;
              top: 0;
              left: 0;
              width: 100vw;
              padding: 20px;
              background: white;
              display: flex;
              flex-direction: column;
              align-items: center;
              page-break-inside: avoid;
              z-index: 9999;
            }
            .chart-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 20px;
              text-align: center;
              color: black;
            }
            .chart-image {
              max-width: 100%;
              max-height: 80vh;
              border-radius: 8px;
            }
          }
          @media screen {
            #print-container {
              display: none;
            }
          }
        </style>
       
        <img id="chart-image" src="${chartImageData}" class="chart-image" />
      `;
      document.body.appendChild(printContainer);
  
      // Wait for image to load before printing
      const img = printContainer.querySelector<HTMLImageElement>('#chart-image');
      img?.addEventListener('load', () => {
        setTimeout(() => {
          window.print();
        }, 100); // small delay to ensure rendering
  
        window.onafterprint = () => {
          document.body.removeChild(printContainer);
          tempChart.destroy();
          this.isExportDropdownOpen = false;
        };
      });
    }, 500);
  }
  

  // Download image (PNG/JPEG)
  downloadImage(format: 'png' | 'jpeg') {
    // Guard: canvas rendering + anchor-click download is browser-only.
    if (!this.isBrowser) {
      return;
    }

    const width = 5120;
    const height = 3840;
    if (this.chartType === 'radar') {
      const heading = this.convertHtmlToPlainText(this.headingText);
      const svgData = this.generateRadarChartSVG(width - 200, height - 200, 100, true, width, height, heading);
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width='100%' height='100%' fill='#fff'/>${svgData}</svg>`;
      const img = new window.Image();
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d');
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      img.onload = () => {
        ctx?.drawImage(img, 0, 0, width, height);
        const link = document.createElement('a');
        link.download = `${this.hoverLabel.replace(/\s+/g, '_')}_chart.${format}`;
        link.href = tempCanvas.toDataURL(mimeType, 0.95);
        link.click();
        this.isExportDropdownOpen = false;
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      return;
    }
    if (this.chartType === 'polarArea') {
      const heading = this.convertHtmlToPlainText(this.headingText);
      const svgData = this.generatePolarAreaChartSVGProportional(width - 200, height - 200, 100, true, width, height, heading);
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width='100%' height='100%' fill='#fff'/>${svgData}</svg>`;
      const img = new window.Image();
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d');
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      img.onload = () => {
        ctx?.drawImage(img, 0, 0, width, height);
        const link = document.createElement('a');
        link.download = `${this.hoverLabel.replace(/\s+/g, '_')}_chart.${format}`;
        link.href = tempCanvas.toDataURL(mimeType, 0.95);
        link.click();
        this.isExportDropdownOpen = false;
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      return;
    }
    const chartConfig = this.getHighResChartConfig(width, height, true);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    
    const whiteBgPlugin = {
      id: 'whiteBackground',
      beforeDraw: (chart: any) => {
        const ctx = chart.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    };
    
    const configWithHook = {
      ...chartConfig,
      plugins: [
        ...(chartConfig.plugins || []),
        whiteBgPlugin,
        {
          id: 'imageExportHook',
          afterRender: (chart: any) => {
            setTimeout(() => {
              const link = document.createElement('a');
              const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
              link.download = `${this.hoverLabel.replace(/\s+/g, '_')}_chart.${format}`;
              link.href = tempCanvas.toDataURL(mimeType, 0.95);
              link.click();
              chart.destroy();
              this.isExportDropdownOpen = false;
            }, 100);
          }
        }
      ]
    };
    
    new Chart(tempCanvas, configWithHook);
  }


  // Download PDF
  async downloadPDF() {
    // Guard: canvas + dynamic pdfmake import target the browser.
    if (!this.isBrowser) {
      return;
    }

    const { default: pdfMake } = await import('pdfmake/build/pdfmake');
    const { default: pdfFonts } = await import('pdfmake/build/vfs_fonts');
    
    const width = 1122;
    const height = 793;
    const chartConfig = this.getHighResChartConfig(width, height, true);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    
    // Create chart with white background and donut text
    const configWithBg = {
      ...chartConfig,
      plugins: [
        ...(chartConfig.plugins || []),
        {
          id: 'whiteBackground',
          beforeDraw: (chart: any) => {
            const ctx = chart.ctx;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
          }
        }
      ]
    };
    
    const tempChart = new Chart(tempCanvas, configWithBg);
    
    // Wait for chart to render before getting image data
    setTimeout(() => {
      const imgData = tempCanvas.toDataURL('image/png');
      
      const docDefinition: any = {
        content: [
          // {
          //   text: this.hoverLabel,
          //   style: 'header',
          //   alignment: 'center',
          //   margin: [0, 0, 0, 20]
          // },
          {
            image: imgData,
            width: 500,
            alignment: 'center'
          }
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true
          }
        }
      };
      
      pdfMake.createPdf(docDefinition).download(`${this.hoverLabel.replace(/\s+/g, '_')}_chart.pdf`);
      tempChart.destroy();
      this.isExportDropdownOpen = false;
    }, 0);
  }

  // Download SVG
  downloadSVG() {
    // Guard: Blob/URL/anchor-click download is browser-only.
    if (!this.isBrowser) {
      return;
    }

    const svgData = this.generateSVG();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    // Note: hoverLabel is used for filename, not SVG content, so escaping here is for filename safety
    link.download = `${this.hoverLabel.replace(/\s+/g, '_')}_chart.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    this.isExportDropdownOpen = false;
  }

  // Helper function to escape text for safe inclusion in XML/SVG
  private escapeXml(unsafe: any): string {
    if (typeof unsafe !== 'string') {
      return String(unsafe);
    }
    return unsafe.replace(/[&<>"']/g, (match) => {
      switch (match) {
        case '&': return '&amp;';
        case '<': return '<';
        case '>': return '>';
        case '"': return '&quot;';
        case "'": return '&apos;';
        default: return match;
      }
    });
  }

  // Generate SVG based on chart type
  private generateSVG(): string {
    const width = 800;
    const height = 600;
    const padding = 60;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding - 60; // Extra space for title
    const isDarkMode = document.documentElement.classList.contains('dark');
    const backgroundColor = isDarkMode ? '#1a1a1a' : '#ffffff';
    const textColor = isDarkMode ? '#ffffff' : '#000000';
    const gridColor = isDarkMode ? '#333333' : '#dddddd';
    let chartSVG = '';
    if (this.chartType === 'bar') {
      chartSVG = this.generateBarChartSVG(chartWidth, chartHeight, padding, width, height, gridColor, textColor);
    } else if (this.chartType === 'line' || this.isAreaChart()) {
      chartSVG = this.generateLineChartSVG(chartWidth, chartHeight, padding, width, height, gridColor, textColor);
    } else if (this.chartType === 'pie' || this.chartType === 'doughnut') {
      chartSVG = this.generatePieChartSVG(chartWidth, chartHeight, padding);
    } else if (this.chartType === 'radar') {
      chartSVG = this.generateRadarChartSVG(chartWidth, chartHeight, padding);
    } else if (this.chartType === 'polarArea') {
      chartSVG = this.generatePolarAreaChartSVG(chartWidth, chartHeight, padding);
    }else if (this.chartType === 'groupedBar') {  // ADD THIS
      chartSVG = this.generateGroupedBarChartSVG(chartWidth, chartHeight, padding, width, height, gridColor, textColor);
    }
    // Main heading - Escape the text content
    const headingTextEscaped = this.escapeXml(this.convertHtmlToPlainText(this.headingText));
    const heading = `<text x="${width/2}" y="40" text-anchor="middle" fill="${textColor}" font-size="22" font-weight="bold">${headingTextEscaped}</text>`;
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${backgroundColor}"/>
        ${heading}
        ${chartSVG}
      </svg>
    `;
  }

  // Bar chart SVG with grid, axis, and labels
  private generateBarChartSVG(chartWidth: number, chartHeight: number, padding: number, width?: number, height?: number, gridColor?: string, textColor?: string): string {
    const maxValue = Math.max(...this.chartData);
    const minValue = 0;
    const yTicks = 5;
    const barWidth = chartWidth / this.chartData.length * 0.8;
    const barSpacing = chartWidth / this.chartData.length * 0.2;
    let svg = '';
    // Draw horizontal grid lines and y-axis ticks
    for (let i = 0; i <= yTicks; i++) {
      const y = padding + 60 + chartHeight - (i / yTicks) * chartHeight;
      const value = minValue + (maxValue - minValue) * (i / yTicks);
      svg += `<line x1="${padding}" y1="${y}" x2="${padding + chartWidth}" y2="${y}" stroke="${gridColor}" stroke-width="1" />`;
      // Value labels are numbers, less likely to cause issues, but good practice to escape
      svg += `<text x="${padding - 8}" y="${y + 4}" text-anchor="end" fill="${textColor}" font-size="12">${this.escapeXml(Math.round(value))}</text>`;
    }
    // Draw vertical grid lines (for each bar)
    for (let i = 0; i < this.chartData.length; i++) {
      const x = padding + i * (barWidth + barSpacing) + barSpacing / 2 + barWidth / 2;
      svg += `<line x1="${x}" y1="${padding + 60}" x2="${x}" y2="${padding + 60 + chartHeight}" stroke="${gridColor}" stroke-width="1" opacity="0.5" />`;
    }
    // Draw bars and x labels
    for (let i = 0; i < this.chartData.length; i++) {
      const value = this.chartData[i];
      const barHeight = (value / maxValue) * chartHeight;
      const x = padding + i * (barWidth + barSpacing) + barSpacing / 2;
      const y = padding + 60 + (chartHeight - barHeight);
      const color = this.backgroundColors[i] || '#4BC0C0';
      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="5"/>`;
      // Escape X-axis labels
      const xLabelEscaped = this.escapeXml(this.chartLabels[i]);
      svg += `<text x="${x + barWidth/2}" y="${padding + 60 + chartHeight + 18}" text-anchor="middle" fill="${textColor}" font-size="12">${xLabelEscaped}</text>`;
    }
    // Y-axis title - Escape the text content
    if (this.yAxisTitle) {
      const yAxisTitleEscaped = this.escapeXml(this.yAxisTitle);
      svg += `<text x="${padding - 40}" y="${padding + 60 + chartHeight/2}" text-anchor="middle" fill="${textColor}" font-size="14" font-weight="bold" transform="rotate(-90,${padding - 40},${padding + 60 + chartHeight/2})">${yAxisTitleEscaped}</text>`;
    }
    // X-axis title - Escape the text content
    if (this.xAxisTitle) {
      const xAxisTitleEscaped = this.escapeXml(this.xAxisTitle);
      svg += `<text x="${padding + chartWidth/2}" y="${padding + 60 + chartHeight + 45}" text-anchor="middle" fill="${textColor}" font-size="14" font-weight="bold">${xAxisTitleEscaped}</text>`;
    }
    return svg;
  }

  // Area/Line chart SVG with area fill, line (bezier), points, grid, axis, and labels
  private generateLineChartSVG(chartWidth: number, chartHeight: number, padding: number, width?: number, height?: number, gridColor?: string, textColor?: string): string {
    const maxValue = Math.max(...this.chartData);
    const minValue = 0;
    const yTicks = 5;
    let svg = '';
    // Draw horizontal grid lines and y-axis ticks
    for (let i = 0; i <= yTicks; i++) {
      const y = padding + 60 + chartHeight - (i / yTicks) * chartHeight;
      const value = minValue + (maxValue - minValue) * (i / yTicks);
      svg += `<line x1="${padding}" y1="${y}" x2="${padding + chartWidth}" y2="${y}" stroke="${gridColor}" stroke-width="1" />`;
      // Escape Y-axis tick labels
      svg += `<text x="${padding - 8}" y="${y + 4}" text-anchor="end" fill="${textColor}" font-size="12" font-weight="bold">${this.escapeXml(Math.round(value))}</text>`;
    }
    // Draw vertical grid lines (for each point)
    for (let i = 0; i < this.chartData.length; i++) {
      const x = padding + (i / (this.chartData.length - 1)) * chartWidth;
      svg += `<line x1="${x}" y1="${padding + 60}" x2="${x}" y2="${padding + 60 + chartHeight}" stroke="${gridColor}" stroke-width="1" opacity="0.5" />`;
    }
    // Prepare points
    const valueRange = maxValue - minValue || 1;
    const pointsArr = this.chartData.map((value, index) => {
      const x = padding + (index / (this.chartData.length - 1)) * chartWidth;
      const y = padding + 60 + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      return { x, y };
    });
    // Bezier curve helper (tension: 0.4)
    function getControlPoints(pts: {x:number,y:number}[], tension = 0.4) {
      const cps = [];
      for (let i = 0; i < pts.length; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1] || pts[i];
        const p3 = pts[i + 2] || p2;
        // The smoothing ratio
        const d01 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const d23 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
        // Scaling factors
        const fa = tension * d01 / (d01 + d12);
        const fb = tension * d12 / (d12 + d23);
        // Control points
        const cp1x = p1.x + fa * (p2.x - p0.x);
        const cp1y = p1.y + fa * (p2.y - p0.y);
        const cp2x = p2.x - fb * (p3.x - p1.x);
        const cp2y = p2.y - fb * (p3.y - p1.y);
        cps.push({cp1x, cp1y, cp2x, cp2y});
      }
      return cps;
    }
    // Build bezier path for area and line
    let areaPath = '';
    let linePath = '';
    const isArea = this.isAreaChart();
    const color = this.backgroundColors[0] || '#4BC0C0';
    if (pointsArr.length > 1) {
      const cps = getControlPoints(pointsArr, 0.4);
      // Area path
      if (isArea) {
        areaPath = `M ${pointsArr[0].x} ${padding + 60 + chartHeight} L ${pointsArr[0].x} ${pointsArr[0].y}`;
        for (let i = 0; i < pointsArr.length - 1; i++) {
          areaPath += ` C ${cps[i].cp1x} ${cps[i].cp1y}, ${cps[i].cp2x} ${cps[i].cp2y}, ${pointsArr[i + 1].x} ${pointsArr[i + 1].y}`;
        }
        areaPath += ` L ${pointsArr[pointsArr.length - 1].x} ${padding + 60 + chartHeight} Z`;
        svg += `<path d="${areaPath}" fill="${color}" opacity="0.18"/>`;
      }
      // Line path
      linePath = `M ${pointsArr[0].x} ${pointsArr[0].y}`;
      for (let i = 0; i < pointsArr.length - 1; i++) {
        linePath += ` C ${cps[i].cp1x} ${cps[i].cp1y}, ${cps[i].cp2x} ${cps[i].cp2y}, ${pointsArr[i + 1].x} ${pointsArr[i + 1].y}`;
      }
      svg += `<path d="${linePath}" stroke="${color}" stroke-width="4" fill="none"/>`;
    } else if (pointsArr.length === 1) {
      // Single point: just draw the point
      // (no line or area)
    }
    // Draw points
    pointsArr.forEach(pt => {
      svg += `<circle cx="${pt.x}" cy="${pt.y}" r="8" fill="white" stroke="${color}" stroke-width="3"/>`;
    });
    // X labels - Escape the text content
    this.chartLabels.forEach((label, index) => {
      const x = padding + (index / (this.chartData.length - 1)) * chartWidth;
      const xLabelEscaped = this.escapeXml(label);
      svg += `<text x="${x}" y="${padding + 60 + chartHeight + 18}" text-anchor="middle" fill="${textColor}" font-size="12">${xLabelEscaped}</text>`;
    });
    // Y-axis title - Escape the text content
    if (this.yAxisTitle) {
      const yAxisTitleEscaped = this.escapeXml(this.yAxisTitle);
      svg += `<text x="${padding - 40}" y="${padding + 60 + chartHeight/2}" text-anchor="middle" fill="${textColor}" font-size="14" font-weight="bold" transform="rotate(-90,${padding - 40},${padding + 60 + chartHeight/2})">${yAxisTitleEscaped}</text>`;
    }
    // X-axis title - Escape the text content
    if (this.xAxisTitle) {
      const xAxisTitleEscaped = this.escapeXml(this.xAxisTitle);
      svg += `<text x="${padding + chartWidth/2}" y="${padding + 60 + chartHeight + 45}" text-anchor="middle" fill="${textColor}" font-size="14" font-weight="bold">${xAxisTitleEscaped}</text>`;
    }
    return svg;
  }

  // Generate Pie Chart SVG
  private generatePieChartSVG(chartWidth: number, chartHeight: number, padding: number): string {
    const centerX = padding + chartWidth / 2;
    const centerY = padding + 60 + chartHeight / 2;
    const radius = Math.min(chartWidth, chartHeight) / 2 - 20;
    const isDoughnut = this.chartType === 'doughnut';
    const innerRadius = isDoughnut ? radius * 0.6 : 0;
    const total = this.chartData.reduce((sum, value) => sum + value, 0);
    let currentAngle = 0;
    let svg = '';
    // Draw segments
    this.chartData.forEach((value, index) => {
      const angle = (value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      const x1 = centerX + Math.cos(startAngle) * radius;
      const y1 = centerY + Math.sin(startAngle) * radius;
      const x2 = centerX + Math.cos(endAngle) * radius;
      const y2 = centerY + Math.sin(endAngle) * radius;
      const largeArcFlag = angle > Math.PI ? 1 : 0;
      const color = this.backgroundColors[index] || `hsl(${index * 360 / this.chartData.length}, 70%, 60%)`;
      if (isDoughnut) {
        const ix1 = centerX + Math.cos(startAngle) * innerRadius;
        const iy1 = centerY + Math.sin(startAngle) * innerRadius;
        const ix2 = centerX + Math.cos(endAngle) * innerRadius;
        const iy2 = centerY + Math.sin(endAngle) * innerRadius;
        svg += `<path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1} Z" fill="${color}"/>`;
      } else {
        svg += `<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${color}"/>`;
      }
      currentAngle += angle;
    });
    // Add center text for doughnut - Escape the text content
    if (isDoughnut && this.donutCenterText) {
      const donutLine1Escaped = this.escapeXml(this.donutCenterText.line1 || '');
      const donutLine2Escaped = this.escapeXml(this.donutCenterText.line2 || '');
      const donutLine3Escaped = this.escapeXml(this.donutCenterText.line3 || ''); // Handle potential undefined
      svg += `<text x="${centerX}" y="${centerY - 10}" text-anchor="middle" fill="black" font-size="24" font-weight="bold">${donutLine1Escaped}</text>`;
      svg += `<text x="${centerX}" y="${centerY + 15}" text-anchor="middle" fill="black" font-size="16">${donutLine2Escaped}</text>`;
      if (this.donutCenterText.line3) { // Only add if line3 exists
        svg += `<text x="${centerX}" y="${centerY + 35}" text-anchor="middle" fill="black" font-size="16">${donutLine3Escaped}</text>`;
      }
    }
    // --- Add data labels with lines ---
    let angleCursor = 0;
    this.chartData.forEach((value, index) => {
      const angle = (value / total) * 2 * Math.PI;
      const midAngle = angleCursor + angle / 2;
      const labelColor = this.backgroundColors[index] || `hsl(${index * 360 / this.chartData.length}, 70%, 60%)`;
      // Start point: arc edge
      const arcRadius = isDoughnut ? (radius + innerRadius) / 2 : radius * 0.95;
      const arcX = centerX + Math.cos(midAngle) * arcRadius;
      const arcY = centerY + Math.sin(midAngle) * arcRadius;
      // End point: outside arc
      const labelRadius = radius + 35;
      const labelX = centerX + Math.cos(midAngle) * labelRadius;
      const labelY = centerY + Math.sin(midAngle) * labelRadius;
      // Label text anchor
      const anchor = Math.cos(midAngle) > 0.1 ? 'start' : Math.cos(midAngle) < -0.1 ? 'end' : 'middle';
      // Draw line
      svg += `<path d="M ${arcX} ${arcY} Q ${centerX + Math.cos(midAngle) * (radius + 15)} ${centerY + Math.sin(midAngle) * (radius + 15)}, ${labelX} ${labelY}" stroke="${labelColor}" stroke-width="1.2" fill="none"/>`;
      // Draw label - Escape the text content
      const dataLabelEscaped = this.escapeXml(this.chartLabels[index]);
      svg += `<text x="${labelX + (anchor === 'start' ? 6 : anchor === 'end' ? -6 : 0)}" y="${labelY + 4}" font-size="15" fill="black" text-anchor="${anchor}" font-weight="bold">${dataLabelEscaped}</text>`;
      angleCursor += angle;
    });
    // --- End data labels ---
    // Add legend below chart - Escape the text content
    const legendY = centerY + radius + 50;
    const legendItemWidth = 160;
    const legendItemHeight = 22;
    const legendStartX = centerX - (this.chartLabels.length * legendItemWidth) / 2 + legendItemWidth / 2;
    this.chartLabels.forEach((label, i) => {
      const legendColor = this.backgroundColors[i] || `hsl(${i * 360 / this.chartData.length}, 70%, 60%)`;
      const x = legendStartX + i * legendItemWidth;
      svg += `<circle cx="${x - 40}" cy="${legendY}" r="8" fill="${legendColor}" />`;
      const legendLabelEscaped = this.escapeXml(label);
      svg += `<text x="${x - 25}" y="${legendY + 5}" font-size="15" fill="black" text-anchor="start">${legendLabelEscaped}</text>`;
    });
    return svg;
  }

  // Generate Radar Chart SVG
  private generateRadarChartSVG(chartWidth: number, chartHeight: number, padding: number, forceExportColors: boolean = false, exportWidth: number = 0, exportHeight: number = 0, headingText: string = ''): string {
    // Use exportWidth/exportHeight if provided, else fallback to chartWidth/chartHeight
    const width = exportWidth || chartWidth + 2 * padding;
    const height = exportHeight || chartHeight + 2 * padding + 60;
    // Proportional font and grid sizes
    const base = Math.max(width, height);
    const headingFontSize = Math.round(base * 0.035); // e.g. 135 for 3840x5120
    const axisLabelFontSize = Math.round(base * 0.022);
    const valueLabelFontSize = Math.round(base * 0.018);
    const ringValueFontSize = Math.round(base * 0.016);
    const gridStrokeWidth = Math.max(2, Math.round(base * 0.002));
    const pointRadius = Math.max(10, Math.round(base * 0.012));
    const chartPadding = Math.max(padding, Math.round(base * 0.04));
    const headingPadding = Math.round(base * 0.04);
    // Center chart below heading
    const centerX = width / 2;
    const centerY = headingPadding + (height - headingPadding) / 2;
    const radius = Math.min(width, height - headingPadding) / 2 - chartPadding;
    const numPoints = this.chartData.length;
    const maxValue = Math.max(...this.chartData);
    // Colors
    const gridColor = forceExportColors ? '#bbb' : (document.documentElement.classList.contains('dark') ? '#333333' : '#dddddd');
    const axisLabelColor = forceExportColors ? '#222' : (document.documentElement.classList.contains('dark') ? '#fff' : '#222');
    const valueLabelColor = forceExportColors ? '#222' : (document.documentElement.classList.contains('dark') ? '#fff' : '#222');
    const ringValueColor = forceExportColors ? '#888' : '#888';
    const dataStroke = 'rgb(75, 192, 192)';
    const dataFill = 'rgba(75, 192, 192, 0.18)';
    const pointFill = '#fff';
    const pointStroke = 'rgb(75, 192, 192)';
    let svg = '';
    // Heading - Escape the text content
    if (headingText) {
      const headingTextEscaped = this.escapeXml(headingText);
      svg += `<text x="${centerX}" y="${headingPadding - headingFontSize/2}" text-anchor="middle" fill="${axisLabelColor}" font-size="${headingFontSize}" font-weight="bold">${headingTextEscaped}</text>`;
    }
    // Draw grid lines (concentric polygons)
    for (let i = 1; i <= 5; i++) {
      const gridRadius = (radius / 5) * i;
      let gridPath = '';
      for (let j = 0; j < numPoints; j++) {
        const angle = (j * 2 * Math.PI) / numPoints - Math.PI / 2;
        const x = centerX + Math.cos(angle) * gridRadius;
        const y = centerY + Math.sin(angle) * gridRadius;
        if (j === 0) {
          gridPath = `M ${x} ${y}`;
        } else {
          gridPath += ` L ${x} ${y}`;
        }
      }
      gridPath += ' Z';
      svg += `<path d="${gridPath}" stroke="${gridColor}" stroke-width="${gridStrokeWidth}" fill="none"/>`;
      // Add value labels for each grid ring (on the first axis only) - Escape the text content
      if (numPoints > 0) {
        const angle = -Math.PI / 2;
        const x = centerX + Math.cos(angle) * gridRadius - ringValueFontSize;
        const y = centerY + Math.sin(angle) * gridRadius + ringValueFontSize/2;
        const value = Math.round((maxValue / 5) * i);
        svg += `<text x="${x}" y="${y}" text-anchor="end" fill="${ringValueColor}" font-size="${ringValueFontSize}">${this.escapeXml(value)}</text>`;
      }
    }
    // Draw axis lines and axis labels - Escape the text content
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * 2 * Math.PI) / numPoints - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      svg += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="${gridColor}" stroke-width="${gridStrokeWidth}"/>`;
      // Add axis labels (move further out for clarity)
      const labelRadius = radius + chartPadding * 0.7;
      const labelX = centerX + Math.cos(angle) * labelRadius;
      const labelY = centerY + Math.sin(angle) * labelRadius + axisLabelFontSize/2;
      const axisLabelEscaped = this.escapeXml(this.chartLabels[i]);
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="${axisLabelColor}" font-size="${axisLabelFontSize}" font-weight="bold">${axisLabelEscaped}</text>`;
    }
    // Draw data polygon and value labels
    let dataPath = '';
    const pointCoords: {x: number, y: number}[] = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * 2 * Math.PI) / numPoints - Math.PI / 2;
      const value = this.chartData[i];
      const dataRadius = (value / maxValue) * radius;
      const x = centerX + Math.cos(angle) * dataRadius;
      const y = centerY + Math.sin(angle) * dataRadius;
      pointCoords.push({x, y});
      if (i === 0) {
        dataPath = `M ${x} ${y}`;
      } else {
        dataPath += ` L ${x} ${y}`;
      }
    }
    dataPath += ' Z';
    svg += `<path d="${dataPath}" stroke="${dataStroke}" stroke-width="${gridStrokeWidth + 1}" fill="${dataFill}"/>`;
    // Draw data points and value labels
    pointCoords.forEach((pt, i) => {
      svg += `<circle cx="${pt.x}" cy="${pt.y}" r="${pointRadius}" fill="${pointFill}" stroke="${pointStroke}" stroke-width="${gridStrokeWidth + 1}"/>`;
      // Value label (slightly outside the point) - Escape the text content
      const angle = (i * 2 * Math.PI) / numPoints - Math.PI / 2;
      const valueLabelRadius = (this.chartData[i] / maxValue) * radius + pointRadius * 1.5;
      const valueLabelX = centerX + Math.cos(angle) * valueLabelRadius;
      const valueLabelY = centerY + Math.sin(angle) * valueLabelRadius + valueLabelFontSize/2;
      svg += `<text x="${valueLabelX}" y="${valueLabelY}" text-anchor="middle" fill="${valueLabelColor}" font-size="${valueLabelFontSize}" font-weight="bold">${this.escapeXml(this.chartData[i])}</text>`;
    });
    // Add color legend (only for export) - Escape the text content
    if (forceExportColors && this.chartLabels.length > 0) {
      const legendFontSize = Math.round(base * 0.022);
      const legendCircleRadius = Math.round(base * 0.012);
      const legendSpacing = Math.round(base * 0.04);
      const legendY = height - chartPadding * 0.5;
      // Calculate total legend width
      let totalLegendWidth = 0;
      const legendItems = this.chartLabels.map((label, i) => {
        const color = this.backgroundColors[i] || `hsl(${i * 360 / this.chartLabels.length}, 70%, 60%)`;
        const textWidth = label.length * legendFontSize * 0.6;
        totalLegendWidth += legendCircleRadius * 2 + 8 + textWidth + legendSpacing;
        const legendLabelEscaped = this.escapeXml(label);
        return { label: legendLabelEscaped, color, textWidth };
      });
      let legendX = (width - totalLegendWidth) / 2 + legendCircleRadius;
      legendItems.forEach((item, i) => {
        svg += `<circle cx="${legendX}" cy="${legendY}" r="${legendCircleRadius}" fill="${item.color}" />`;
        svg += `<text x="${legendX + legendCircleRadius + 8}" y="${legendY + legendFontSize/2 - 2}" font-size="${legendFontSize}" fill="#222" text-anchor="start">${item.label}</text>`;
        legendX += legendCircleRadius * 2 + 8 + item.textWidth + legendSpacing;
      });
    }
    return svg;
  }

  // Generate Polar Area Chart SVG
  private generatePolarAreaChartSVG(chartWidth: number, chartHeight: number, padding: number): string {
    const centerX = padding + chartWidth / 2;
    const centerY = padding + 60 + chartHeight / 2;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2 - 40;
    const numSegments = this.chartData.length;
    const maxValue = Math.max(...this.chartData);
    let svg = '';
    // Draw background grid: concentric circles
    const gridColor = document.documentElement.classList.contains('dark') ? '#333333' : '#dddddd';
    const textColor = document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000';
    const gridCircles = 5;
    for (let i = 1; i <= gridCircles; i++) {
      const r = (maxRadius / gridCircles) * i;
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${r}" fill="none" stroke="${gridColor}" stroke-width="1" opacity="0.7"/>`;
    }
    // Draw radial lines
    for (let i = 0; i < numSegments; i++) {
      const angle = (i * 2 * Math.PI) / numSegments;
      const x = centerX + Math.cos(angle) * maxRadius;
      const y = centerY + Math.sin(angle) * maxRadius;
      svg += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="${gridColor}" stroke-width="1" opacity="0.7"/>`;
    }
    // Draw segments
    this.chartData.forEach((value, index) => {
      const startAngle = (index * 2 * Math.PI) / numSegments;
      const endAngle = ((index + 1) * 2 * Math.PI) / numSegments;
      const radius = (value / maxValue) * maxRadius;
      const x1 = centerX + Math.cos(startAngle) * radius;
      const y1 = centerY + Math.sin(startAngle) * radius;
      const x2 = centerX + Math.cos(endAngle) * radius;
      const y2 = centerY + Math.sin(endAngle) * radius;
      const largeArcFlag = (endAngle - startAngle) > Math.PI ? 1 : 0;
      const segmentColor = this.backgroundColors[index] || `hsl(${index * 360 / numSegments}, 70%, 60%)`;
      svg += `<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${segmentColor}" opacity="0.8"/>`;
    });
    // Draw labels for each segment - Escape the text content
    this.chartLabels.forEach((label, index) => {
      const angle = ((index + 0.5) * 2 * Math.PI) / numSegments;
      const labelRadius = maxRadius + 18;
      const labelX = centerX + Math.cos(angle) * labelRadius;
      const labelY = centerY + Math.sin(angle) * labelRadius;
      const segmentLabelEscaped = this.escapeXml(label);
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="${textColor}" font-size="13" font-weight="bold">${segmentLabelEscaped}</text>`;
    });
    // Add legend below chart - Escape the text content
    const legendY = centerY + maxRadius + 40;
    const legendItemWidth = 160;
    const legendStartX = centerX - (this.chartLabels.length * legendItemWidth) / 2 + legendItemWidth / 2;
    this.chartLabels.forEach((label, i) => {
      const legendColor = this.backgroundColors[i] || `hsl(${i * 360 / this.chartData.length}, 70%, 60%)`;
      const x = legendStartX + i * legendItemWidth;
      svg += `<circle cx="${x - 40}" cy="${legendY}" r="8" fill="${legendColor}" />`;
      const legendLabelEscaped = this.escapeXml(label);
      svg += `<text x="${x - 25}" y="${legendY + 5}" font-size="15" fill="${textColor}" text-anchor="start">${legendLabelEscaped}</text>`;
    });
    return svg;
  }




  
  // Download CSV
  downloadCSV() {
    // Guard: Blob/URL/anchor-click download is browser-only.
    if (!this.isBrowser) {
      return;
    }

    const csvContent = this.generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${this.hoverLabel.replace(/\s+/g, '_')}_data.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.isExportDropdownOpen = false;
  }
  
  // Generate CSV content
  private generateCSVContent(): string {
    let csv = 'Label,Value\n';
    
    this.chartLabels.forEach((label, index) => {
      const value = this.chartData[index];
      // Escape commas and quotes in labels
      const escapedLabel = label.includes(',') || label.includes('"') ? `"${label.replace(/"/g, '""')}"` : label;
      csv += `${escapedLabel},${value}\n`;
    });
    
    return csv;
  }
  
  // Download Excel
  async downloadExcel() {
    // Guard: canvas rendering + dynamic exceljs import is browser-only.
    if (!this.isBrowser) {
      return;
    }

    // Step 1: Generate chart image (PNG)
    const width = 1200;
    const height = 800;
    const chartConfig = this.getHighResChartConfig(width, height, true);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
  
    const whiteBgPlugin = {
      id: 'whiteBackground',
      beforeDraw: (chart: any) => {
        const ctx = chart.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    };
  
    const configWithBg = {
      ...chartConfig,
      plugins: [...(chartConfig.plugins || []), whiteBgPlugin],
    };
  
    const tempChart = new Chart(tempCanvas, configWithBg);
    await new Promise(resolve => setTimeout(resolve, 100));
  
    const imageDataUrl = tempCanvas.toDataURL('image/png');
    const imageBuffer = this.dataURLToBuffer(imageDataUrl);
  
    // Step 2: Use ExcelJS
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();
    const worksheet = workbook.addWorksheet('Chart');
  
    // Add data
    worksheet.addRow(['Label', 'Value']);
    this.chartLabels.forEach((label, i) => {
      worksheet.addRow([label, this.chartData[i]]);
    });
    worksheet.getColumn('A').width = 20;
    worksheet.getColumn('B').width = 15;
  
    // ✅ CORRECT: Add image to WORKBOOK first → returns imageId
    const imageId = workbook.addImage({
    
      extension: 'png',
    });
  
    // ✅ CORRECT: Then add image to WORKSHEET using imageId + position
    worksheet.addImage(imageId, {
      tl: { col: 3, row: 0 }, // top-left: column 3 (D), row 0 (1st row)
      ext: { width: 800, height: 600 },
    });
  
    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${this.hoverLabel.replace(/\s+/g, '_')}_chart.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  
    tempChart.destroy();
    this.isExportDropdownOpen = false;
  }

  private dataURLToBuffer(dataURL: string): Uint8Array {
    const base64 = dataURL.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  convertHtmlToPlainText(input: string): string {
    try {
      if (!input) return '';
      return input
        .replace(/<sup[^>]*>(.*?)<\/sup>/gi, '$1')
        .replace(/&nbsp;?/gi, ' ')
        .replace(/&\w+;/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (error) {
      console.error('Error converting HTML to plain text:', error);
      return '';
    }
  }
  
  

  ngOnDestroy() {
    // Guard: nothing to clean up on the server since nothing was created there.
    if (!this.isBrowser) {
      return;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener('resize', this.handleWindowResize);
    if (this.currentFullscreenChart) {
      this.currentFullscreenChart.cleanup();
      if (this.currentFullscreenChart.chart) {
        this.currentFullscreenChart.chart.destroy();
      }
      if (this.currentFullscreenChart.overlay.parentNode) {
        this.currentFullscreenChart.overlay.parentNode.removeChild(this.currentFullscreenChart.overlay);
      }
    }
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
    if (this.myChart) {
      this.myChart.destroy();
      this.myChart = null;
    }
  }

  // For polar chart export, add a similar proportional SVG generator
  private generatePolarAreaChartSVGProportional(chartWidth: number, chartHeight: number, padding: number, forceExportColors: boolean = false, exportWidth: number = 0, exportHeight: number = 0, headingText: string = ''): string {
    const width = exportWidth || chartWidth + 2 * padding;
    const height = exportHeight || chartHeight + 2 * padding + 60;
    const base = Math.max(width, height);
    const headingFontSize = Math.round(base * 0.035);
    const axisLabelFontSize = Math.round(base * 0.022);
    const valueLabelFontSize = Math.round(base * 0.018);
    const gridStrokeWidth = Math.max(2, Math.round(base * 0.002));
    const chartPadding = Math.max(padding, Math.round(base * 0.04));
    const headingPadding = Math.round(base * 0.04);
    const centerX = width / 2;
    const centerY = headingPadding + (height - headingPadding) / 2;
    const maxRadius = Math.min(width, height - headingPadding) / 2 - chartPadding;
    const numSegments = this.chartData.length;
    const maxValue = Math.max(...this.chartData);
    // Colors
    const gridColor = forceExportColors ? '#bbb' : (document.documentElement.classList.contains('dark') ? '#333333' : '#dddddd');
    const axisLabelColor = forceExportColors ? '#222' : (document.documentElement.classList.contains('dark') ? '#fff' : '#222');
    const valueLabelColor = forceExportColors ? '#222' : (document.documentElement.classList.contains('dark') ? '#fff' : '#222');
    let svg = '';
    // Heading
    if (headingText) {
      svg += `<text x="${centerX}" y="${headingPadding - headingFontSize/2}" text-anchor="middle" fill="${axisLabelColor}" font-size="${headingFontSize}" font-weight="bold">${headingText}</text>`;
    }
    // Draw background grid: concentric circles
    const gridCircles = 5;
    for (let i = 1; i <= gridCircles; i++) {
      const r = (maxRadius / gridCircles) * i;
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${r}" fill="none" stroke="${gridColor}" stroke-width="${gridStrokeWidth}" opacity="0.7"/>`;
      // Value label (on first axis)
      if (i < gridCircles) {
        const value = Math.round((maxValue / gridCircles) * i);
        svg += `<text x="${centerX - 10}" y="${centerY - r + valueLabelFontSize/2}" text-anchor="end" fill="#888" font-size="${valueLabelFontSize}">${value}</text>`;
      }
    }
    // Draw radial lines and axis labels
    for (let i = 0; i < numSegments; i++) {
      const angle = (i * 2 * Math.PI) / numSegments;
      const x = centerX + Math.cos(angle) * maxRadius;
      const y = centerY + Math.sin(angle) * maxRadius;
      svg += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="${gridColor}" stroke-width="${gridStrokeWidth}" opacity="0.7"/>`;
      // Axis label
      const labelRadius = maxRadius + chartPadding * 0.7;
      const labelX = centerX + Math.cos(angle) * labelRadius;
      const labelY = centerY + Math.sin(angle) * labelRadius + axisLabelFontSize/2;
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="${axisLabelColor}" font-size="${axisLabelFontSize}" font-weight="bold">${this.chartLabels[i]}</text>`;
    }
    // Draw segments and value labels
    this.chartData.forEach((value, index) => {
      const startAngle = (index * 2 * Math.PI) / numSegments;
      const endAngle = ((index + 1) * 2 * Math.PI) / numSegments;
      const radius = (value / maxValue) * maxRadius;
      const x1 = centerX + Math.cos(startAngle) * radius;
      const y1 = centerY + Math.sin(startAngle) * radius;
      const x2 = centerX + Math.cos(endAngle) * radius;
      const y2 = centerY + Math.sin(endAngle) * radius;
      const largeArcFlag = (endAngle - startAngle) > Math.PI ? 1 : 0;
      const segmentColor = this.backgroundColors[index] || `hsl(${index * 360 / numSegments}, 70%, 60%)`;
      svg += `<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${segmentColor}" opacity="0.8"/>`;
      // Value label (middle of segment)
      const midAngle = (startAngle + endAngle) / 2;
      const valueLabelRadius = radius + chartPadding * 0.3;
      const valueLabelX = centerX + Math.cos(midAngle) * valueLabelRadius;
      const valueLabelY = centerY + Math.sin(midAngle) * valueLabelRadius + valueLabelFontSize/2;
      svg += `<text x="${valueLabelX}" y="${valueLabelY}" text-anchor="middle" fill="${valueLabelColor}" font-size="${valueLabelFontSize}" font-weight="bold">${value}</text>`;
    });
    // Add color legend (only for export)
    if (forceExportColors && this.chartLabels.length > 0) {
      const legendFontSize = Math.round(base * 0.022);
      const legendCircleRadius = Math.round(base * 0.012);
      const legendSpacing = Math.round(base * 0.04);
      const legendY = height - chartPadding * 0.5;
      // Calculate total legend width
      let totalLegendWidth = 0;
      const legendItems = this.chartLabels.map((label, i) => {
        const color = this.backgroundColors[i] || `hsl(${i * 360 / this.chartLabels.length}, 70%, 60%)`;
        const textWidth = label.length * legendFontSize * 0.6;
        totalLegendWidth += legendCircleRadius * 2 + 8 + textWidth + legendSpacing;
        return { label, color, textWidth };
      });
      let legendX = (width - totalLegendWidth) / 2 + legendCircleRadius;
      legendItems.forEach((item, i) => {
        svg += `<circle cx="${legendX}" cy="${legendY}" r="${legendCircleRadius}" fill="${item.color}" />`;
        svg += `<text x="${legendX + legendCircleRadius + 8}" y="${legendY + legendFontSize/2 - 2}" font-size="${legendFontSize}" fill="#222" text-anchor="start">${item.label}</text>`;
        legendX += legendCircleRadius * 2 + 8 + item.textWidth + legendSpacing;
      });
    }
    return svg;
  }

  private createGroupedBarChart(): void {
    // Guard: touches `document` and creates a Chart.js instance.
    if (!this.isBrowser) {
      return;
    }

    const isDarkMode = document.documentElement.classList.contains('dark');
    const labelColor = isDarkMode ? 'white' : 'black';
    const gridColor = isDarkMode ? '#333' : '#ddd';
    
    const groupSize = this.groupedData[0]?.length || 2;
    
    // Prepare datasets - one for each position in the group
    const datasets = [];
    for (let i = 0; i < groupSize; i++) {
      const color = this.groupColors[i % this.groupColors.length] || `hsl(${i * 360 / groupSize}, 70%, 60%)`;
      const label = this.groupLabels[i % this.groupLabels.length] || `Series ${i + 1}`;
      
      datasets.push({
        label: label,
        data: this.groupedData.map(group => group[i] || 0),
        backgroundColor: color,
        borderRadius: {
          topLeft: 10,
          topRight: 10,
        },
      });
    }
  
    const data: ChartData = {
      labels: this.chartLabels,
      datasets: datasets,
    };
  
    const config: ChartConfiguration = {
      type: 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 850,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 6,
              boxHeight: 6,
              color: labelColor,
              padding: 10,
            },
          },
          tooltip: {
            enabled: true,
          },
        },
        scales: {
          x: {
            title: {
              display: !!this.xAxisTitle,
              text: this.xAxisTitle,
              font: {
                size: 10,
                weight: 'bold',
              },
              color: labelColor,
            },
            ticks: {
              color: labelColor,
            },
            grid: {
              color: gridColor,
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: !!this.yAxisTitle,
              text: this.yAxisTitle,
              color: labelColor,
              font: {
                size: 10,
                weight: 'bold',
              },
            },
            ticks: {
              color: labelColor,
            },
            grid: {
              color: gridColor,
            },
          },
        },
      },
    };
  
    if (this.myChart) {
      this.myChart.destroy();
      this.myChart = null;
    }
  
    const canvas = this.chartCanvasRef?.nativeElement || (document.getElementById(this.chartId) as HTMLCanvasElement);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      this.myChart = new Chart(canvas, config);
    }
  }


  private getGroupedBarConfig(width: number, height: number, forceWhite: boolean = false, forFullscreen: boolean = false): any {
    const isDarkMode = forceWhite ? false : document.documentElement.classList.contains('dark');
    const labelColor = forceWhite ? 'black' : (isDarkMode ? 'white' : 'black');
    const gridColor = forceWhite ? '#ddd' : (isDarkMode ? '#333' : '#ddd');
    
    const headingFontSize = Math.max(Math.round(height * 0.035), 18);
    const axisTitleFontSize = Math.max(Math.round(height * 0.025), 14);
    const tickFontSize = Math.max(Math.round(height * 0.018), 12);
    const legendFontSize = Math.max(Math.round(height * 0.022), 14);
    
    const groupSize = this.groupedData[0]?.length || 2;
    const datasets = [];
    
    for (let i = 0; i < groupSize; i++) {
      const color = this.groupColors[i % this.groupColors.length] || `hsl(${i * 360 / groupSize}, 70%, 60%)`;
      const label = this.groupLabels[i % this.groupLabels.length] || `Series ${i + 1}`;
      
      datasets.push({
        label: label,
        data: this.groupedData.map(group => group[i] || 0),
        backgroundColor: color,
        borderRadius: { topLeft: 10, topRight: 10 },
      });
    }
  
    return {
      type: 'bar',
      data: {
        labels: this.chartLabels,
        datasets: datasets,
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: legendFontSize,
              boxHeight: legendFontSize,
              color: labelColor,
              padding: Math.round(legendFontSize * 1.2),
              font: { size: legendFontSize }
            },
          },
          tooltip: {
            enabled: forFullscreen ? true : false,
          },
          title: {
            display: !!this.convertHtmlToPlainText(this.headingText),
            text: this.convertHtmlToPlainText(this.headingText),
            color: labelColor,
            font: {
              size: headingFontSize,
              weight: 'bold',
            },
            padding: { top: Math.round(headingFontSize * 0.5), bottom: Math.round(headingFontSize * 0.5) }
          },
        },
        scales: {
          x: {
            title: {
              display: !!this.xAxisTitle,
              text: this.xAxisTitle,
              font: { size: axisTitleFontSize, weight: 'bold' },
              color: labelColor,
              padding: Math.round(axisTitleFontSize * 0.5)
            },
            ticks: {
              color: labelColor,
              font: { size: tickFontSize },
              padding: Math.round(tickFontSize * 0.5)
            },
            grid: { color: gridColor },
          },
          y: {
            beginAtZero: true,
            title: {
              display: !!this.yAxisTitle,
              text: this.yAxisTitle,
              color: labelColor,
              font: { size: axisTitleFontSize, weight: 'bold' },
              padding: Math.round(axisTitleFontSize * 0.5)
            },
            ticks: {
              color: labelColor,
              font: { size: tickFontSize },
              padding: Math.round(tickFontSize * 0.5)
            },
            grid: { color: gridColor },
          },
        },
      },
    };
  }


  private generateGroupedBarChartSVG(chartWidth: number, chartHeight: number, padding: number, width?: number, height?: number, gridColor?: string, textColor?: string): string {
  const maxValue = Math.max(...this.groupedData.flat());
  const minValue = 0;
  const yTicks = 5;
  const groupSize = this.groupedData[0]?.length || 2;
  const groupWidth = chartWidth / this.chartLabels.length * 0.8;
  const barWidth = groupWidth / groupSize;
  const groupSpacing = chartWidth / this.chartLabels.length * 0.2;
  
  let svg = '';
  
  // Draw horizontal grid lines and y-axis ticks
  for (let i = 0; i <= yTicks; i++) {
    const y = padding + 60 + chartHeight - (i / yTicks) * chartHeight;
    const value = minValue + (maxValue - minValue) * (i / yTicks);
    svg += `<line x1="${padding}" y1="${y}" x2="${padding + chartWidth}" y2="${y}" stroke="${gridColor}" stroke-width="1" />`;
    svg += `<text x="${padding - 8}" y="${y + 4}" text-anchor="end" fill="${textColor}" font-size="12">${this.escapeXml(Math.round(value))}</text>`;
  }
  
  // Draw grouped bars
  for (let i = 0; i < this.chartLabels.length; i++) {
    const groupX = padding + i * (groupWidth + groupSpacing) + groupSpacing / 2;
    
    for (let j = 0; j < groupSize; j++) {
      const value = this.groupedData[i]?.[j] || 0;
      const barHeight = (value / maxValue) * chartHeight;
      const x = groupX + j * barWidth;
      const y = padding + 60 + (chartHeight - barHeight);
      const color = this.groupColors[j % this.groupColors.length] || `hsl(${j * 360 / groupSize}, 70%, 60%)`;
      
      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="5"/>`;
    }
    
    // X-axis labels
    const xLabelEscaped = this.escapeXml(this.chartLabels[i]);
    svg += `<text x="${groupX + groupWidth/2}" y="${padding + 60 + chartHeight + 18}" text-anchor="middle" fill="${textColor}" font-size="12">${xLabelEscaped}</text>`;
  }
  
  // Y-axis title
  if (this.yAxisTitle) {
    const yAxisTitleEscaped = this.escapeXml(this.yAxisTitle);
    svg += `<text x="${padding - 40}" y="${padding + 60 + chartHeight/2}" text-anchor="middle" fill="${textColor}" font-size="14" font-weight="bold" transform="rotate(-90,${padding - 40},${padding + 60 + chartHeight/2})">${yAxisTitleEscaped}</text>`;
  }
  
  // X-axis title
  if (this.xAxisTitle) {
    const xAxisTitleEscaped = this.escapeXml(this.xAxisTitle);
    svg += `<text x="${padding + chartWidth/2}" y="${padding + 60 + chartHeight + 45}" text-anchor="middle" fill="${textColor}" font-size="14" font-weight="bold">${xAxisTitleEscaped}</text>`;
  }
  
  // Legend
  const legendY = padding + 60 + chartHeight + 70;
  const legendItemWidth = 120;
  const legendStartX = padding + chartWidth/2 - (groupSize * legendItemWidth) / 2;
  
  for (let i = 0; i < groupSize; i++) {
    const color = this.groupColors[i % this.groupColors.length] || `hsl(${i * 360 / groupSize}, 70%, 60%)`;
    const label = this.groupLabels[i % this.groupLabels.length] || `Series ${i + 1}`;
    const x = legendStartX + i * legendItemWidth;
    
    svg += `<rect x="${x}" y="${legendY - 5}" width="12" height="12" fill="${color}" rx="2"/>`;
    svg += `<text x="${x + 18}" y="${legendY + 5}" font-size="12" fill="${textColor}" text-anchor="start">${this.escapeXml(label)}</text>`;
  }
  
  return svg;
}


getFilteredChartTypes() {
  if (this.selectedChart?.value === 'groupedBar') {
    return this.chartTypes.filter(t => t.value === 'groupedBar');
  } else {
    return this.chartTypes.filter(t => t.value !== 'groupedBar');
  }
}


}