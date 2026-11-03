import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Custom line-icon set (no emojis). Usage: <p-icon name="home" [size]="20" />
 * Every icon is a 24x24 stroke icon and inherits `currentColor`.
 */
@Component({
  selector: 'p-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:inline-flex;line-height:0' },
  template: `
  <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    @switch (name) {
      @case ('home') { <path d="M3.5 10.8 12 4l8.5 6.8"/><path d="M5.5 9.5V19a1 1 0 0 0 1 1H10v-5.2h4V20h3.5a1 1 0 0 0 1-1V9.5"/> }
      @case ('plan') { <rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 10h17"/><path d="M7.5 15h3"/> }
      @case ('addons') { <path d="M12 3.5 19.5 7.5v9L12 20.5l-7.5-4v-9L12 3.5Z"/><path d="M12 12 19.5 7.5M12 12v8.5M12 12 4.5 7.5"/> }
      @case ('implementation') { <path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="m3 5 4 2.5L12 3l4.5 4L21 4"/> }
      @case ('training') { <path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z"/><path d="M6.5 11.2V15c0 1.3 2.5 2.8 5.5 2.8s5.5-1.5 5.5-2.8v-3.8"/><path d="M21.5 9v5"/> }
      @case ('support') { <path d="M4.5 13v-1.5a7.5 7.5 0 0 1 15 0V13"/><rect x="3.5" y="12.5" width="4" height="6" rx="1.8"/><rect x="16.5" y="12.5" width="4" height="6" rx="1.8"/><path d="M18.5 18.5c0 1.6-1.6 2.5-4 2.5h-1.5"/> }
      @case ('download') { <path d="M12 4v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/> }
      @case ('invoice') { <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8v-17Z"/><path d="M9.5 8.5h5M9.5 12h5"/> }
      @case ('analytics') { <rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 16v-4M12 16V8M16 16v-6"/> }
      @case ('manager') { <circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.6-3.6 3.3-5.6 7.2-5.6s6.6 2 7.2 5.6"/> }
      @case ('settings') { <circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/> }
      @case ('search') { <circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/> }
      @case ('bell') { <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/> }
      @case ('ticket') { <path d="M3.5 8.5V6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v2a2 2 0 0 0 0 4v3.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 16v-3.5a2 2 0 0 0 0-4Z"/><path d="M14 5v12.5" stroke-dasharray="1.8 2.4"/> }
      @case ('bolt') { <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/> }
      @case ('arrow') { <path d="M5 12h14"/><path d="m13 6 6 6-6 6"/> }
      @case ('check') { <path d="m5 12.5 4.5 4.5L19 7.5"/> }
      @case ('clock') { <circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/> }
      @case ('chevron') { <path d="m7 10 5 5 5-5"/> }
      @case ('logout') { <path d="M10 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H10"/><path d="M15 8.5 19 12l-4 3.5M19 12H9.5"/> }
      @case ('menu') { <path d="M4 7h16M4 12h16M4 17h10"/> }
      @case ('close') { <path d="m6 6 12 12M18 6 6 18"/> }
      @case ('calendar') { <rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/> }
      @case ('video') { <rect x="3" y="6.5" width="12.5" height="11" rx="3"/><path d="m15.5 11 5-3v8l-5-3"/> }
      @case ('face') { <path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16"/><path d="M9 10v1M15 10v1M9.5 15c1.6 1.2 3.4 1.2 5 0"/> }
      @case ('geo') { <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10" r="2.3"/> }
      @case ('shift') { <rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14.5h3M13 14.5h3"/> }
      @case ('payroll') { <rect x="3" y="6" width="18" height="12" rx="3"/><circle cx="12" cy="12" r="2.6"/> }
      @case ('timesheet') { <rect x="5" y="4.5" width="14" height="16" rx="2.5"/><path d="M9 4.5v-1h6v1"/><circle cx="12" cy="13" r="3.2"/><path d="M12 11.4V13l1.1.8"/> }
      @case ('track') { <circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/> }
      @case ('clients') { <circle cx="9" cy="9" r="3"/><path d="M3.5 19c.5-3 2.6-4.6 5.5-4.6s5 1.6 5.5 4.6"/><path d="M16 6.5a3 3 0 0 1 0 5.6M17.5 14.6c1.8.5 3 1.9 3.3 4.4"/> }
      @case ('visit') { <path d="M12 21s6-5.2 6-10.2A6 6 0 0 0 6 10.8C6 15.8 12 21 12 21Z"/><path d="m9.5 10.5 1.8 1.8 3.2-3.4"/> }
      @case ('expense') { <path d="M5 4.5h14v15l-2.3-1.6-2.4 1.6-2.3-1.6-2.4 1.6L7.3 17.9 5 19.5v-15Z"/><path d="M9 9h6M9 12.5h4"/> }
      @case ('leave') { <path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14Z"/><path d="M5 19c2.5-4 5-6.5 9-8.5"/> }
      @case ('employee') { <rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6.3 16c.4-1.5 1.4-2.3 2.7-2.3s2.3.8 2.7 2.3M14.5 10h3M14.5 13.5h3"/> }
      @case ('attendance') { <circle cx="10" cy="8.5" r="3.4"/><path d="M3.8 20c.5-3.4 3-5.3 6.2-5.3"/><path d="m14.5 17 2 2 3.8-4.2"/> }
      @case ('organization') { <rect x="9" y="3.5" width="6" height="4.5" rx="1.4"/><rect x="3" y="16" width="6" height="4.5" rx="1.4"/><rect x="15" y="16" width="6" height="4.5" rx="1.4"/><path d="M12 8v3.5M6 16v-4.5h12V16"/> }
      @case ('salary') { <path d="M4 8V7a2.5 2.5 0 0 1 2.5-2.5H17v3.5"/><rect x="3.5" y="8" width="17" height="11.5" rx="3"/><path d="M20.5 12.5h-3.2a1.8 1.8 0 0 0 0 3.6h3.2"/> }
      @case ('performance') { <path d="M3.5 20h17"/><path d="m5 16 4.5-5 3.5 3L19 7.5"/><path d="M15 7.5h4v4"/> }
      @case ('geofence') { <circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><path d="M12 16.5s3-2.4 3-5a3 3 0 1 0-6 0c0 2.6 3 5 3 5Z"/><circle cx="12" cy="11.5" r="1"/> }
      @case ('timeoff') { <path d="M3.5 12a8.5 8.5 0 0 1 17 0Z"/><path d="M12 3.5V12v6.5a2 2 0 0 0 4 0"/> }
      @case ('attach') { <path d="m20 11.5-7.6 7.6a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.6-2.6l7.4-7.4"/> }
      @case ('camera') { <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-1.8h5.6L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z"/><circle cx="12" cy="12.5" r="3.4"/> }
      @case ('external') { <path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M18 14v3.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10"/> }
      @case ('stop') { <rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/> }
      @case ('plus') { <path d="M12 5v14M5 12h14"/> }
      @case ('trash') { <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7"/> }
      @case ('info') { <circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/> }
      @case ('alert') { <path d="M12 4 3 19.5h18L12 4Z"/><path d="M12 10v4.5M12 17v.1"/> }
      @case ('user') { <circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.6-3.6 3.3-5.6 7.2-5.6s6.6 2 7.2 5.6"/> }
      @default { <circle cx="12" cy="12" r="8"/> }
    }
  </svg>`,
})
export class PortalIcon {
  @Input() name = '';
  @Input() size = 20;
}