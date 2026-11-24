import { Component, Input, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/services/auth-service';
import { storageCfg } from '../core/storage-prefix';

/** Shown for the '/login' route inside the embed: tells the host the user signed out. */
@Component({ selector: 'ubi-embed-logout', standalone: true, template: '' })
export class EmbedLogoutComponent {
  constructor() { window.dispatchEvent(new CustomEvent('ubiclient:logout')); }
}

/**
 * <ubi-client-portal> — the client portal inside a Shadow DOM.
 * Host sets the properties `user` and `pass` (HRMS login credentials) before/after attaching it.
 */
@Component({
  selector: 'ubi-client-portal',
  standalone: true,
  imports: [RouterOutlet],
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `
    @if (state() === 'ready') { <router-outlet /> }
    @else if (state() === 'error') { <div class="msg err">{{ error() }}</div> }
    @else { <div class="hrms-loader"><i></i></div> }
  `,
  styles: [`
    :host { all: initial; display: block; font-family: Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif; }
    /* Tailwind-preflight equivalent: the portal components were written assuming it */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid #e5e7eb; }
    h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
    a { color: inherit; text-decoration: inherit; }
    ol, ul { list-style: none; }
    img, svg, video, canvas { display: block; max-width: 100%; }
    img, video { height: auto; }
    button, input, select, textarea { font: inherit; letter-spacing: inherit; color: inherit; background-color: transparent; border-radius: 0; }
    table { border-collapse: collapse; }
    [hidden] { display: none !important; }
    /* Fit under the HRMS top bar instead of the full viewport */
    .frame { height: var(--ubi-embed-height, calc(100vh - 50px)) !important; }


    /* ===== HRMS-aligned theme (embedded build only; everything stays inside this shadow root) ===== */
    :host { --hrms-top: 50px; }
    * { --accent: #00a07a !important; --accent-bg: #e3f5ee !important; --border: #e5e5e5 !important;
        --muted: #777 !important; --text: #333 !important; --radius: 3px !important; --bg: transparent !important; }
    *:not(i) { font-family: Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif !important; }
    /* remove what HRMS already shows: portal logo/name and the logged-in account */
    .side .brand, .side .foot, .top .profile { display: none !important; }
    .frame, .main { background: transparent !important; }
    .top { background: #fff !important; backdrop-filter: none !important; padding: 8px 20px !important; border-bottom: 1px solid #e5e5e5 !important; }
    .top .search, .top .icon-btn, .top .cta { border-radius: 3px !important; height: 36px !important; }
    .top .icon-btn { width: 36px !important; }
    .top .cta { background: #00a07a !important; border-color: #00a07a !important; color: #fff !important; }
    .top .cta:hover { background: #008f6d !important; box-shadow: none !important; }
    .page { padding: 15px !important; }
    /* sidebar looks like the HRMS left navigation */
    .side { width: 230px !important; height: 100% !important; padding: 0 !important; background: #fff !important; border-right: 1px solid #e5e5e5 !important; }
    .side .nav { gap: 0 !important; }
    .side .item { border-radius: 0 !important; border-bottom: 1px solid #eee !important; padding: 12px 14px !important; font-size: 14px !important; font-weight: 400 !important; color: #333 !important; }
    .side .item:hover { transform: none !important; background: #f7fbf9 !important; }
    .side .item .ico, .side .item.active .ico { background: transparent !important; width: 22px !important; height: 22px !important; color: #333 !important; }
    .side .item.active { background: #f0faf5 !important; box-shadow: none !important; font-weight: 500 !important; }
    .side .item.active::before { left: 0 !important; top: 0 !important; bottom: 0 !important; border-radius: 0 !important; }
    @media (max-width: 1023px) { .side { top: var(--hrms-top) !important; height: auto !important; } }
    /* modals / drawers start below the HRMS header instead of being hidden behind it */
    .scrim, .overlay { top: var(--hrms-top) !important; }
    .drawer { top: var(--hrms-top) !important; }
    .scrim > .drawer { top: auto !important; }
    .dialog { max-height: calc(100vh - var(--hrms-top) - 40px) !important; }
    .dialog.lg { height: calc(100vh - var(--hrms-top) - 40px) !important; }
    /* no search bar in the embedded build; slimmer top bar */
    .top .search { display: none !important; }
    .top { padding: 6px 15px !important; }
    /* squarer HRMS-style controls inside pages and modals */
    .dash button, .plan-page button, .addons-page button, .impl-page button, .usage-page button,
    .dialog button, .drawer button, .dialog input, .dialog textarea, .dialog select, .drawer input, .drawer textarea, .drawer select { border-radius: 3px !important; }
    .dialog { border-radius: 3px !important; }
    /* every page: HRMS-style title bar and flat cards */
    .dash .head, .plan-page .head, .addons-page .head, .impl-page .head, .usage-page .head { background: #fff; border-radius: 3px; padding: 8px 14px !important; gap: 10px !important; box-shadow: 0 1px 1px rgba(0,0,0,.1); }
    .dash .head-ico, .plan-page .head-ico, .addons-page .head-ico, .impl-page .head-ico, .usage-page .head-ico { width: auto !important; height: auto !important; background: none !important; border: 0 !important; box-shadow: none !important; color: #333 !important; }
    .dash .head-text h1, .plan-page .head-text h1, .addons-page .head-text h1, .impl-page .head-text h1, .usage-page .head-text h1 { font-size: 20px !important; letter-spacing: 0 !important; font-weight: 700 !important; line-height: 1.2 !important; color: #333 !important; }
    /* portal name lives in the (otherwise empty) top bar, left side; Raise A Ticket stays right */
    :host([data-csp]) .top { display: flex !important; align-items: center !important; }
    :host([data-csp]) .top::before { content: "Client Success Portal"; margin-right: auto; padding-left: 34px; min-height: 26px; display: flex; align-items: center; font-size: 22px; font-weight: 700; letter-spacing: .2px; line-height: 1.15; color: #1f3a33; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300a07a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z'/%3E%3Cpath d='M8.5 12l2.5 2.5 4.5-5'/%3E%3C/svg%3E") no-repeat left center / 26px 26px; }
    /* same pattern as other HRMS page headers (icon + bold title) with a soft green tint and accent line so it still stands out */
    :host([data-csp]) .top { background: #f1faf6 !important; border-bottom: 3px solid #00a07a !important; }
    @media (max-width: 767px) { :host([data-csp]) .top::before { font-size: 18px; padding-left: 30px; background-size: 22px 22px; } }
    @media (max-width: 480px) { :host([data-csp]) .top::before { font-size: 16px; } }
    .side::before { content: "Support Navigation"; display: block; background: #00a07a; color: #fff; font-size: 12px; padding: 8px 14px; }
    /* sidebar like the other HRMS navigation panels: small green label strip, firmer item text */
    :host([data-csp]) .side::before { content: "Portal Navigation"; }
    :host([data-csp]) .side .item { color: #222 !important; font-weight: 500 !important; }
    :host([data-csp]) .side .item.active { font-weight: 700 !important; }
    .dash .head-text p, .plan-page .head-text p, .addons-page .head-text p, .impl-page .head-text p, .usage-page .head-text p { font-size: 12px !important; margin-top: 0 !important; }
    .dash .date-pill { border-radius: 3px !important; height: 30px !important; }
    .dash .card, .plan-page .card, .addons-page .card, .impl-page .card, .usage-page .card { border-radius: 3px !important; border: 1px solid #e5e5e5 !important; box-shadow: 0 1px 1px rgba(0,0,0,.08) !important; }
    .dash .card:hover, .plan-page .card:hover, .addons-page .card:hover, .impl-page .card:hover, .usage-page .card:hover { transform: none !important; box-shadow: 0 1px 3px rgba(0,0,0,.15) !important; }
    .dash .card::before, .plan-page .card::before, .addons-page .card::before, .impl-page .card::before, .usage-page .card::before { display: none !important; }
    /* same loader as the rest of HRMS (FontAwesome 4 fa-refresh fa-spin, 30px) */
    .hrms-loader { text-align: center; padding: 40px 0; color: #333; }
    .hrms-loader i { display: inline-block; font: normal normal normal 30px/1 FontAwesome; animation: hrmsSpin 2s infinite linear; }
    .hrms-loader i::before { content: "\\f021"; }
    @keyframes hrmsSpin { from { transform: rotate(0deg); } to { transform: rotate(359deg); } }
    .msg { padding: 40px; text-align: center; color: #5c685e; }
    .msg.err { color: #c02626; }
  `],
})
export class PortalEmbedComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  @Input() user = '';
  @Input() pass = '';

  state = signal<'loading' | 'ready' | 'error'>('loading');
  error = signal('');

  private get userKey() { return storageCfg.prefix + 'forUser'; }

  async ngOnInit() {
    try {
      // Reuse an existing session only if it belongs to the same HRMS user.
      if (this.auth.getToken() && localStorage.getItem(this.userKey) === this.user
          && await firstValueFrom(this.auth.autoLogin()) && this.auth.isClient()) {
        return this.open();
      }
      if (!this.user || !this.pass) return this.fail('Missing credentials.');

      let res: any;
      try { res = await firstValueFrom(this.auth.login(this.user, this.pass)); }
      catch (e: any) {
        if (e?.status === 409 || e?.error?.code === 'SESSION_LIMIT') {
          res = await firstValueFrom(this.auth.login(this.user, this.pass, true));
        } else { res = e?.error ?? {}; }
      }
      if (res?.code === 'SESSION_LIMIT') res = await firstValueFrom(this.auth.login(this.user, this.pass, true));

      if (res?.status === true && this.auth.isClient()) {
        localStorage.setItem(this.userKey, this.user);
        return this.open();
      }
      this.fail(res?.status === true ? 'This account does not have a client portal.' : (res?.msg || 'Could not sign in to Support.'));
    } catch {
      this.fail('Support is unavailable right now. Please try again.');
    }
  }

  private open() {
    this.state.set('ready');
    this.router.navigateByUrl('/client-portal/dashboard');
  }
  private fail(m: string) { this.error.set(m); this.state.set('error'); }
}