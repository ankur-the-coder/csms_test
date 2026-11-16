import { Injectable } from '@angular/core';
import { LocationStrategy } from '@angular/common';

/** Keeps the portal's router history in memory so it never touches the host (HRMS) URL. */
@Injectable()
export class MemoryLocationStrategy extends LocationStrategy {
  private stack: string[] = [''];
  private i = 0;
  private listeners: Array<(e: any) => any> = [];

  path(): string { return this.stack[this.i]; }
  prepareExternalUrl(url: string): string { return url; }
  getState(): unknown { return null; }
  getBaseHref(): string { return ''; }
  pushState(_s: any, _t: string, url: string, query: string): void {
    this.stack = this.stack.slice(0, this.i + 1);
    this.stack.push(url + (query ? '?' + query : ''));
    this.i++;
  }
  replaceState(_s: any, _t: string, url: string, query: string): void {
    this.stack[this.i] = url + (query ? '?' + query : '');
  }
  forward(): void { if (this.i < this.stack.length - 1) { this.i++; this.emit(); } }
  back(): void { if (this.i > 0) { this.i--; this.emit(); } }
  onPopState(fn: (e: any) => any): void { this.listeners.push(fn); }
  private emit(): void { this.listeners.forEach(f => f({ type: 'popstate', state: null })); }
}
