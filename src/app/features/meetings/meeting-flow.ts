import {
  Component,
  Input,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  NgZone,
  ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface ArrowState {
  el: HTMLElement;
  isUp: boolean;
  leftTarget: HTMLElement | null;
  rightTarget: HTMLElement | null;
  hit: SVGPathElement;
  ln: SVGPathElement;
  hd: SVGPathElement;
  pk: SVGCircleElement[];
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  isDragging: boolean;
  t: number;
  cleanup?: () => void;
}

@Component({
  selector: 'app-meeting-flow',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="meeting-flow-wrapper">
      <div class="flow-container">
        <!-- Client Node -->
        <div class="node client-node">
          <div class="node-icon-wrapper client-icon">
            <img src="onlyLogo.png" alt="ubiClient" class="logo-img" />
          </div>
          <span class="node-label">
            <span style="color: #0f172a; font-weight: 700;">ubi</span><span style="color: #0d9488; font-weight: 700;">Client</span>
          </span>
        </div>

        <!-- Arrow 1 (ubiClient -> Teams) -->
        <div class="arrow-connector" data-arrow="up"></div>

        <!-- Teams Node (Floating in center) -->
        <div class="node teams">
          <div class="node-icon-wrapper teams-icon">
            <!-- Official Microsoft Teams Fluent Icon -->
            <img src="teamsLogo.png" alt="Microsoft Teams" class="flow-hub-logo teams-logo-img" draggable="false" />
          </div>
          <span class="node-label">Graph API</span>
        </div>

        <!-- Arrow 2 (Teams -> Organization) -->
        <div class="arrow-connector" data-arrow="down"></div>

        <!-- Organization Node -->
        <div class="node org-node">
          <div class="org-avatar">{{ orgInit }}</div>
          <span class="node-label truncate max-w-[100px]" [title]="displayOrgName">{{ displayOrgName }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .meeting-flow-wrapper {
      width: 100%;
      margin: 0 0 20px 0;
    }

    /* Seamless Flow Canvas without box border */
    .flow-container {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 10px 4px 12px;
      background: transparent;
      border: none;
      box-shadow: none;
      user-select: none;
      width: 100%;
      box-sizing: border-box;
    }

    .node {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      width: 86px;
      text-align: center;
      flex-shrink: 0;
      margin-top: 18px; /* Align ubiClient & Org below Teams */
    }

    .node.teams {
      margin-top: 0; /* Elevated position for Teams */
    }

    .node-label {
      font-size: 12.5px;
      font-weight: 600;
      color: #334155;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }

    .node-icon-wrapper {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .client-icon {
      padding: 6px;
      background: #ffffff;
      border-color: #e2e8f0;
    }

    .logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,0.05));
    }

    .node.teams .node-icon-wrapper {
      border-color: #c7d2fe;
      background: #f8f9ff;
      box-shadow: 0 4px 14px -2px rgba(79, 70, 229, 0.16);
      animation: teams-float 3s ease-in-out infinite;
    }

    .teams-logo-img {
  width: 100%;
  height: 100%;
  padding: 9px;            /* breathing room inside the box, increase for a smaller logo */
  object-fit: contain;     /* keeps the logo's proportions, never stretches */
  display: block;
  pointer-events: none;
  user-select: none;
}

    @keyframes teams-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }

    .org-avatar {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 700;
      box-shadow: 0 4px 12px -2px rgba(13, 148, 136, 0.35);
    }

    /* Dynamic Connectors accurately spanning icon centers */
    .arrow-connector {
      flex: 1;
      min-width: 40px;
      max-width: 110px;
      height: 74px;
      position: relative;
      margin: 0 4px;
      touch-action: none;
    }

    .arrow-connector svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      cursor: grab;
      outline: none;
    }

    .arrow-connector svg:active {
      cursor: grabbing;
    }

    .arrow-connector .ln {
      fill: none;
      stroke: #4f46e5;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-dasharray: 6 5;
      animation: dash 0.85s linear infinite;
    }

    .arrow-connector .hit {
      fill: none;
      stroke: transparent;
      stroke-width: 28;
    }

    .arrow-connector .hd {
      fill: #4f46e5;
    }

    .arrow-connector .pk {
      fill: #0d9488;
      filter: drop-shadow(0 1px 2px rgba(13, 148, 136, 0.4));
    }

    @keyframes dash {
      to { stroke-dashoffset: -11; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, ::before, ::after { animation: none !important; transition: none !important; }
    }

    @media (max-width: 480px) {
      .flow-container { padding: 6px 2px 10px; }
      .node { width: 72px; margin-top: 14px; }
      .node.teams { margin-top: 0; }
      .node-label { font-size: 11px; }
      .node-icon-wrapper, .org-avatar { width: 46px; height: 46px; border-radius: 12px; font-size: 18px; }
      
      .arrow-connector { min-width: 28px; height: 60px; margin: 0 2px; }
    }
  `]
})
export class MeetingFlowComponent implements AfterViewInit, OnDestroy {
  @Input() orgName?: string = 'Kubitech';

  private animId?: number;
  private arrows: ArrowState[] = [];
  private destroyed = false;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private ngZone: NgZone
  ) {}

  get displayOrgName(): string {
    return (this.orgName && this.orgName.trim()) ? this.orgName.trim() : 'Kubitech';
  }

  get orgInit(): string {
    return this.displayOrgName.charAt(0).toUpperCase();
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initArrows();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
    }
    this.arrows.forEach(a => a.cleanup?.());
    this.arrows = [];
  }

  private initArrows(): void {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const connectorEls = this.elementRef.nativeElement.querySelectorAll<HTMLElement>('[data-arrow]');

    const clientIcon = this.elementRef.nativeElement.querySelector<HTMLElement>('.client-icon');
    const teamsIcon = this.elementRef.nativeElement.querySelector<HTMLElement>('.teams-icon');
    const orgAvatar = this.elementRef.nativeElement.querySelector<HTMLElement>('.org-avatar');

    this.arrows = Array.from(connectorEls).map((el, i) => {
      const isUp = el.dataset['arrow'] === 'up';
      const leftTarget = isUp ? clientIcon : teamsIcon;
      const rightTarget = isUp ? teamsIcon : orgAvatar;

      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('tabindex', '0');
      svg.setAttribute('role', 'button');
      svg.setAttribute('aria-label', 'Interactive data flow direction indicator');

      const createPath = (className: string) => {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', className);
        svg.appendChild(path);
        return path;
      };

      const hit = createPath('hit');
      const ln = createPath('ln');
      const hd = createPath('hd');

      const pk = [0, 1].map(() => {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', '3.5');
        circle.setAttribute('class', 'pk');
        svg.appendChild(circle);
        return circle;
      });

      el.appendChild(svg);

      const state: ArrowState = {
        el,
        isUp,
        leftTarget,
        rightTarget,
        hit,
        ln,
        hd,
        pk,
        dx: 0,
        dy: 0,
        vx: 0,
        vy: 0,
        isDragging: false,
        t: i * 0.5
      };

      const handlePointer = (e: PointerEvent) => {
        const rect = svg.getBoundingClientRect();
        const cx0 = rect.width * 0.5;
        state.dx = Math.max(-45, Math.min(45, e.clientX - rect.left - cx0));
        state.dy = Math.max(-50, Math.min(60, e.clientY - rect.top - 20));
        state.vx = 0;
        state.vy = 0;
      };

      const onPointerDown = (e: PointerEvent) => {
        state.isDragging = true;
        svg.setPointerCapture(e.pointerId);
        handlePointer(e);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (state.isDragging) handlePointer(e);
      };

      const releasePointer = () => {
        state.isDragging = false;
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          state.vy = 20;
          state.vx = 3;
        }
      };

      svg.addEventListener('pointerdown', onPointerDown);
      svg.addEventListener('pointermove', onPointerMove);
      svg.addEventListener('pointerup', releasePointer);
      svg.addEventListener('pointercancel', releasePointer);
      svg.addEventListener('keydown', onKeyDown);

      state.cleanup = () => {
        svg.removeEventListener('pointerdown', onPointerDown);
        svg.removeEventListener('pointermove', onPointerMove);
        svg.removeEventListener('pointerup', releasePointer);
        svg.removeEventListener('pointercancel', releasePointer);
        svg.removeEventListener('keydown', onKeyDown);
      };

      return state;
    });

    const renderFrame = () => {
      if (this.destroyed) return;

      this.arrows.forEach(a => {
        const width = a.el.clientWidth;
        if (!width) return;

        if (!a.isDragging) {
          a.vx += -0.1 * a.dx;
          a.vy += -0.1 * a.dy;
          a.vx *= 0.88;
          a.vy *= 0.88;
          a.dx += a.vx;
          a.dy += a.vy;
        }

        // Dynamically compute vertical centers based on actual rendered target rects
        let y0 = a.isUp ? 46 : 28;
        let y1 = a.isUp ? 28 : 46;

        if (a.leftTarget && a.rightTarget) {
          const cRect = a.el.getBoundingClientRect();
          const lRect = a.leftTarget.getBoundingClientRect();
          const rRect = a.rightTarget.getBoundingClientRect();

          if (cRect.height > 0) {
            y0 = Math.round((lRect.top + lRect.height / 2) - cRect.top);
            y1 = Math.round((rRect.top + rRect.height / 2) - cRect.top);
          }
        }

        const sx = 2;
        const ex = width - 2;

        // Control point arches smoothly between source and target
        const cx = width * (a.isUp ? 0.5 : 0.48) + a.dx;
        const cy = Math.min(y0, y1) - 6 + a.dy;

        const pathData = 'M ' + sx + ' ' + y0 + ' Q ' + cx + ' ' + cy + ' ' + ex + ' ' + y1;
        a.ln.setAttribute('d', pathData);
        a.hit.setAttribute('d', pathData);

        // Compute tangent vector at end point (ex, y1)
        let ux = ex - cx;
        let uy = y1 - cy;
        const len = Math.hypot(ux, uy) || 1;
        ux /= len;
        uy /= len;

        const nx = -uy;
        const ny = ux;

        // Precise arrowhead pointing directly into the icon edge center
        const headLen = 7;
        const headWidth = 4.5;
        const tx = ex + ux * 2;
        const ty = y1 + uy * 2;
        const bx = ex - ux * headLen;
        const by = y1 - uy * headLen;

        a.hd.setAttribute('d',
          'M ' + tx + ' ' + ty +
          ' L ' + (bx + nx * headWidth) + ' ' + (by + ny * headWidth) +
          ' L ' + (bx - nx * headWidth) + ' ' + (by - ny * headWidth) + ' Z'
        );

        a.t = (a.t + 0.008) % 1;
        a.pk.forEach((circle, idx) => {
          if (prefersReducedMotion) {
            circle.setAttribute('opacity', '0');
            return;
          }
          const progress = (a.t + idx * 0.5) % 1;
          const inv = 1 - progress;
          circle.setAttribute('cx', String(inv * inv * sx + 2 * inv * progress * cx + progress * progress * ex));
          circle.setAttribute('cy', String(inv * inv * y0 + 2 * inv * progress * cy + progress * progress * y1));
          circle.setAttribute('opacity', String(Math.sin(Math.PI * progress)));
        });
      });

      this.animId = requestAnimationFrame(renderFrame);
    };

    this.animId = requestAnimationFrame(renderFrame);
  }
}
