import { Component, ElementRef, OnInit, input, output, signal, viewChild } from '@angular/core';

type Tool = 'crop' | 'highlight' | 'box' | 'arrow' | 'pen';
interface Pt { x: number; y: number; }
interface Shape { tool: Tool; color: string; pts: Pt[]; }
interface Step { prevBase?: HTMLCanvasElement; prevShapes?: Shape[]; }

const HINTS: Record<Tool, string> = {
  crop: 'Drag over the part you want to keep, then release. You can undo a crop.',
  highlight: 'Drag to highlight an area.',
  box: 'Drag to draw a box around something.',
  arrow: 'Drag from the tail to the point of the arrow.',
  pen: 'Draw freely on the screenshot.',
};

/** Full-screen screenshot editor: crop to a region, highlight, box, arrow, pen. Emits the final JPEG. */
@Component({
  selector: 'portal-screenshot-editor',
  standalone: true,
  template: `
    <div class="ed" (click)="$event.stopPropagation()">
      <div class="bar">
        <div class="grp">
          @for (t of tools; track t.id) {
            <button type="button" class="tb" [class.on]="tool() === t.id" (click)="tool.set(t.id)">{{ t.label }}</button>
          }
        </div>
        <div class="grp">
          @for (c of colors; track c) {
            <button type="button" class="sw" [class.on]="color() === c" [style.background]="c" (click)="color.set(c)" [attr.aria-label]="'Colour ' + c"></button>
          }
        </div>
        <div class="grow"></div>
        <button type="button" class="tb" [disabled]="!canUndo()" (click)="undo()">Undo</button>
        <button type="button" class="tb" (click)="retake.emit()">Retake</button>
        <button type="button" class="tb" (click)="cancelled.emit()">Cancel</button>
        <button type="button" class="tb pri" [disabled]="!ready()" (click)="finish()">Attach screenshot</button>
      </div>
      <div class="stage">
        <canvas #cv (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)"></canvas>
      </div>
      <div class="hint">{{ hint() }}</div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .ed { position: fixed; left: 0; right: 0; bottom: 0; top: var(--hrms-top, 50px); z-index: 1200; display: flex; flex-direction: column; background: rgba(15,20,17,.94); }
    .bar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 10px 16px; background: #fff; border-bottom: 1px solid #e5e5e5; }
    .grp { display: flex; align-items: center; gap: 6px; }
    .grow { flex: 1; }
    .tb { height: 34px; padding: 0 14px; border: 1px solid #d9d9d9; border-radius: 3px; background: #fff; color: #333; font-size: 13px; cursor: pointer; }
    .tb:hover:not(:disabled) { background: #f3f7f5; }
    .tb.on { background: #e3f5ee; border-color: #00a07a; color: #007a5e; font-weight: 600; }
    .tb.pri { background: #00a07a; border-color: #00a07a; color: #fff; font-weight: 600; }
    .tb:disabled { opacity: .45; cursor: default; }
    .sw { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #bbb; cursor: pointer; }
    .sw.on { box-shadow: 0 0 0 2px #00a07a; }
    .stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 14px; overflow: auto; }
    canvas { display: block; max-width: 100%; max-height: 100%; background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.5); cursor: crosshair; touch-action: none; }
    .hint { padding: 8px 16px; text-align: center; font-size: 12.5px; color: #cfd8d3; }
  `],
})
export class PortalScreenshotEditor implements OnInit {
  source = input.required<Blob>();
  done = output<Blob>();
  cancelled = output<void>();
  retake = output<void>();

  private cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');

  readonly tools: { id: Tool; label: string }[] = [
    { id: 'crop', label: 'Crop' }, { id: 'highlight', label: 'Highlight' }, { id: 'box', label: 'Box' },
    { id: 'arrow', label: 'Arrow' }, { id: 'pen', label: 'Pen' },
  ];
  readonly colors = ['#ff3b30', '#ffcc00', '#00a07a', '#2563eb', '#111111'];
  tool = signal<Tool>('highlight');
  color = signal('#ff3b30');
  ready = signal(false);
  canUndo = signal(false);
  hint = () => HINTS[this.tool()];

  private base!: HTMLCanvasElement;
  private shapes: Shape[] = [];
  private cur: Shape | null = null;
  private hist: Step[] = [];

  async ngOnInit() {
    const bmp = await createImageBitmap(this.source());
    this.base = document.createElement('canvas');
    this.base.width = bmp.width; this.base.height = bmp.height;
    this.base.getContext('2d')!.drawImage(bmp, 0, 0);
    this.sizeCanvas(); this.render(); this.ready.set(true);
  }

  private sizeCanvas() {
    const c = this.cv().nativeElement;
    c.width = this.base.width; c.height = this.base.height;
  }

  private lw() { return Math.max(3, Math.round(this.base.width / 420)); }

  private paint(ctx: CanvasRenderingContext2D, list: Shape[]) {
    ctx.drawImage(this.base, 0, 0);
    const lw = this.lw();
    for (const s of list) {
      const a = s.pts[0], b = s.pts[s.pts.length - 1];
      ctx.save();
      ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
      if (s.tool === 'highlight') { ctx.globalAlpha = .35; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
      else if (s.tool === 'box') ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      else if (s.tool === 'crop') {
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, this.base.width, this.base.height);
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        ctx.clearRect(x, y, w, h); ctx.drawImage(this.base, x, y, w, h, x, y, w, h);
        ctx.setLineDash([lw * 2, lw * 2]); ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y, w, h);
      } else if (s.tool === 'arrow') {
        const ang = Math.atan2(b.y - a.y, b.x - a.x), head = lw * 5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - head * Math.cos(ang - Math.PI / 6), b.y - head * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(b.x - head * Math.cos(ang + Math.PI / 6), b.y - head * Math.sin(ang + Math.PI / 6));
        ctx.closePath(); ctx.fill();
      } else if (s.tool === 'pen') {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); for (const p of s.pts) ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  private render() {
    const c = this.cv().nativeElement;
    this.paint(c.getContext('2d')!, this.cur ? [...this.shapes, this.cur] : this.shapes);
  }

  private pt(e: PointerEvent): Pt {
    const c = this.cv().nativeElement, r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height };
  }

  down(e: PointerEvent) {
    if (!this.ready()) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this.cur = { tool: this.tool(), color: this.color(), pts: [this.pt(e)] };
  }
  move(e: PointerEvent) {
    if (!this.cur) return;
    const p = this.pt(e);
    if (this.cur.tool === 'pen') this.cur.pts.push(p); else this.cur.pts[1] = p;
    this.render();
  }
  up(_e: PointerEvent) {
    const s = this.cur; this.cur = null;
    if (!s || s.pts.length < 2) { this.render(); return; }
    const a = s.pts[0], b = s.pts[s.pts.length - 1];
    if (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) < 8) { this.render(); return; }
    if (s.tool === 'crop') this.applyCrop(a, b);
    else { this.shapes.push(s); this.hist.push({}); }
    this.canUndo.set(this.hist.length > 0);
    this.render();
  }

  private applyCrop(a: Pt, b: Pt) {
    const x = Math.round(Math.max(0, Math.min(a.x, b.x))), y = Math.round(Math.max(0, Math.min(a.y, b.y)));
    const w = Math.round(Math.min(this.base.width - x, Math.abs(b.x - a.x))), h = Math.round(Math.min(this.base.height - y, Math.abs(b.y - a.y)));
    if (w < 20 || h < 20) return;
    const flat = document.createElement('canvas'); flat.width = this.base.width; flat.height = this.base.height;
    this.paint(flat.getContext('2d')!, this.shapes);
    const nb = document.createElement('canvas'); nb.width = w; nb.height = h;
    nb.getContext('2d')!.drawImage(flat, x, y, w, h, 0, 0, w, h);
    this.hist.push({ prevBase: this.base, prevShapes: this.shapes });
    this.base = nb; this.shapes = []; this.sizeCanvas();
  }

  undo() {
    const step = this.hist.pop();
    if (!step) return;
    if (step.prevBase) { this.base = step.prevBase; this.shapes = step.prevShapes ?? []; this.sizeCanvas(); }
    else this.shapes.pop();
    this.canUndo.set(this.hist.length > 0);
    this.render();
  }

  async finish() {
    const out = document.createElement('canvas'); out.width = this.base.width; out.height = this.base.height;
    this.paint(out.getContext('2d')!, this.shapes);
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/jpeg', 0.92));
    if (blob) this.done.emit(blob);
  }
}
