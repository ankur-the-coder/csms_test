import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WebRtcVoiceService } from '../../voice.service';
import { SingleInput, SelectOption } from '../../../../shared/components/inputs/single-input/single-input';
import { CustomButton } from '../../../../shared/components/inputs/custom-button/custom-button';
import { COUNTRY_CODES, splitE164 } from '../../country-codes';
import { isValidPhoneNumber, isPossiblePhoneNumber, getExampleNumber, AsYouType } from 'libphonenumber-js';
import examples from 'libphonenumber-js/examples.mobile.json';

@Component({
  selector: 'app-voice-softphone',
  standalone: true,
  imports: [CommonModule, FormsModule, SingleInput, CustomButton],
  templateUrl: './softphone.html',
  styles: [`
    .softphone-card {
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
    }
    .pulse-ring {
      animation: sonar 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes sonar {
      0% { opacity: 0.55; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.6); }
    }
    .waveform-bar {
      height: 100%;
      animation: waveform 0.9s ease-in-out infinite;
    }
    @keyframes waveform {
      0%, 100% { height: 30%; }
      50% { height: 100%; }
    }
    .toast-in {
      animation: toastIn 0.25s ease-out;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class Softphone implements OnInit, AfterViewInit, OnDestroy {
  public voiceService = inject(WebRtcVoiceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /** Hidden audio element that receives the remote WebRTC stream */
  @ViewChild('remoteAudio') remoteAudioRef!: ElementRef<HTMLAudioElement>;

  /** Phone number input element for auto-focus on page load */
  @ViewChild('phoneInput') phoneInputRef?: ElementRef<HTMLInputElement>;

  dialNumber = '';
  customerNameInput = '';
  selectedClientOrgId: number | null = null;
  clientSearch = '';
  private clientSearchDebounce: any = null;

  /** Country selected in the dialer's country-code picker (drives the E.164 prefix on outbound calls). */
  selectedCountryIso2 = 'IN';

  /** Open/closed state + search term for the compact country picker below. */
  countryDropdownOpen = false;
  countrySearchTerm = '';
  @ViewChild('countryPickerRef') countryPickerRef?: ElementRef<HTMLElement>;

  /** The full country list, filtered by name / ISO2 / dial code as the user types. */
  get filteredCountries() {
    const term = this.countrySearchTerm.trim().toLowerCase();
    if (!term) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.iso2.toLowerCase().includes(term) ||
      c.dialCode.includes(term)
    );
  }

  toggleCountryDropdown(): void {
    this.countryDropdownOpen = !this.countryDropdownOpen;
    this.countryHighlightIndex = -1;
    if (this.countryDropdownOpen) {
      this.contactPickerOpen = false;
      this.recentCallsDropdownOpen = false;
    } else {
      this.countrySearchTerm = '';
    }
  }

  selectCountry(iso2: string): void {
    this.selectedCountryIso2 = iso2;
    this.countryDropdownOpen = false;
    this.countrySearchTerm = '';
    this.countryHighlightIndex = -1;
  }

  /** Index (into filteredCountries) currently highlighted via arrow keys, -1 = none. */
  countryHighlightIndex = -1;

  onCountrySearchInput(term: string): void {
    this.countrySearchTerm = term;
    this.countryHighlightIndex = -1; // list just changed, old index may point at nothing/something else
  }

  /**
   * Arrow-key navigation + Enter-to-select + Escape-to-close for the
   * country dropdown. stopPropagation() on every key it handles is
   * deliberate -- this input is an <input>, so onKeyboardShortcut's
   * global document:keydown handler would otherwise also see the same
   * event (it fires after this, since child-element listeners run before
   * a document-level one during bubbling). That handler's Escape branch
   * in particular has no isInOtherInput guard, so without stopping
   * propagation here, closing this dropdown with Escape would also end/
   * clear whatever the global handler thinks Escape should do.
   */
  onCountrySearchKeydown(event: KeyboardEvent): void {
    const list = this.filteredCountries;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      this.countryHighlightIndex = list.length === 0 ? -1 : (this.countryHighlightIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      this.countryHighlightIndex = list.length === 0 ? -1 : (this.countryHighlightIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const target = list[this.countryHighlightIndex] || list[0];
      if (target) this.selectCountry(target.iso2);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.countryDropdownOpen = false;
      this.countrySearchTerm = '';
      this.countryHighlightIndex = -1;
    }
  }

  /** Open/closed state for the phone-number field's client/contact picker popover. */
  contactPickerOpen = false;
  @ViewChild('contactPickerRef') contactPickerRef?: ElementRef<HTMLElement>;

  toggleContactPicker(): void {
    this.contactPickerOpen = !this.contactPickerOpen;
    this.contactHighlightIndex = -1;
    if (this.contactPickerOpen) {
      this.countryDropdownOpen = false;
      this.recentCallsDropdownOpen = false;
      // Show a starting set of clients so the popover isn't empty on first open.
      this.voiceService.fetchAdminClients(this.clientSearch);
    }
  }

  /** Index (into voiceService.adminClients()) currently highlighted via arrow keys, -1 = none. */
  contactHighlightIndex = -1;

  /**
   * Arrow-key navigation + Enter-to-select + Escape-to-close for the
   * contact picker -- same reasoning/stopPropagation() as
   * onCountrySearchKeydown() above (see its doc comment).
   */
  onContactSearchKeydown(event: KeyboardEvent): void {
    const list = this.voiceService.adminClients();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      this.contactHighlightIndex = list.length === 0 ? -1 : (this.contactHighlightIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      this.contactHighlightIndex = list.length === 0 ? -1 : (this.contactHighlightIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const target = list[this.contactHighlightIndex] || list[0];
      if (target) this.onSelectClient(target.orgId);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.contactPickerOpen = false;
      this.contactHighlightIndex = -1;
    }
  }

  // Closes any open dropdown (country picker, contact picker, recent calls)
  // on any click outside its respective trigger/panel container.
  @HostListener('document:click', ['$event'])
  onDocumentClickOutside(event: MouseEvent): void {
    const target = event.target as Node;
    if (!target) return;

    if (this.countryDropdownOpen) {
      const el = this.countryPickerRef?.nativeElement;
      if (el && !el.contains(target)) {
        this.countryDropdownOpen = false;
        this.countrySearchTerm = '';
      }
    }

    if (this.contactPickerOpen) {
      const el = this.contactPickerRef?.nativeElement;
      if (el && !el.contains(target)) {
        this.contactPickerOpen = false;
      }
    }

    if (this.recentCallsDropdownOpen) {
      const el = this.recentCallsPickerRef?.nativeElement;
      if (el && !el.contains(target)) {
        this.recentCallsDropdownOpen = false;
      }
    }
  }

  /** The E.164 dial code (with leading +) for the currently selected country. */
  get selectedDialCode(): string {
    const country = COUNTRY_CODES.find(c => c.iso2 === this.selectedCountryIso2);
    return country ? `+${country.dialCode}` : '+91';
  }

  /**
   * Converts an ISO 3166-1 alpha-2 code (e.g. "IN") into its flag emoji
   * by combining the two Unicode Regional Indicator Symbol code points
   * (U+1F1E6 = 'A' ... U+1F1FF = 'Z') -- no image assets or icon library
   * needed, the emoji font renders the pair as a single flag glyph.
   * Falls back to the bare code if it's ever missing/malformed.
   *
   * Note: this renders as an actual flag on macOS, iOS, Android, and
   * Windows 11 (Segoe UI Emoji ships flag glyphs there). Windows 10 has
   * no flag glyphs in its emoji font, so the same two-letter pair shows
   * as boxed "IN"-style text there -- a platform font limitation, not a
   * markup bug. An SVG flag set (e.g. the `flag-icons` npm package)
   * would render identically everywhere if that gap matters.
   */
  countryFlagEmoji(iso2: string): string {
    if (!iso2 || iso2.length !== 2) return iso2 || '';
    const codePoints = [...iso2.toUpperCase()].map(c => 0x1f1e6 + (c.charCodeAt(0) - 65));
    return String.fromCodePoint(...codePoints);
  }

  /**
   * Populates both the country picker and the plain-digits number field
   * from a full E.164 number (e.g. from the client picker or a
   * ?number= query param) -- those hand over a complete number, but the
   * input is now just the national/local digits with the country code
   * shown separately, so it needs to be split first.
   */
  private applyFullNumber(fullE164: string): void {
    const { iso2, national } = splitE164(fullE164, this.selectedCountryIso2);
    this.selectedCountryIso2 = iso2;
    this.dialNumber = national;
  }

  /**
   * Builds the full E.164 destination number for makeOutboundCall() from
   * the selected country + whatever's in the plain-digits field. If the
   * user pasted/typed a full number themselves (starts with '+'), that's
   * respected as-is rather than double-prefixing it with the picker's
   * dial code.
   */
  private buildDialString(): string {
    const raw = this.dialNumber.trim();
    if (raw.startsWith('+')) {
      return raw;
    }
    const digitsOnly = raw.replace(/\D/g, '');
    return `${this.selectedDialCode}${digitsOnly}`;
  }

  /**
   * Same shape check VoiceService.logOutboundCallStart() enforces
   * server-side (the actual path this WebRTC dialer hits) -- kept
   * identical so a number that looks valid here won't get rejected
   * server-side, and vice versa. Requires a leading '+', a non-zero
   * first digit, and 2-15 digits total after the '+' (E.164's max length).
   */
  private readonly E164_REGEX = /^\+[1-9]\d{1,14}$/;

  private isE164Shaped(): boolean {
    if (!this.dialNumber.trim()) return false;
    return this.E164_REGEX.test(this.buildDialString());
  }

  /**
   * Single source of truth for the phone field's live validation state.
   * Computed once per change so the preview and the error message below
   * are guaranteed to never show at the same time or drift out of sync
   * with each other -- they're just two branches of the same object,
   * rather than three separate getters each re-deriving shape/possible/
   * valid independently.
   *
   * The isPossiblePhoneNumber() gate is what fixes the premature-error
   * flash: it's a cheap length-only check, so while the user's still
   * short of any plausible length for the selected country this shows
   * neither a preview nor an error -- just quiet. Only once the number
   * is at least as long as a real one *could* be do we treat a still-
   * failing isValidPhoneNumber() as a genuine "that's not right" error.
   */
  private get dialValidationState(): { preview: string | null; error: string | null; valid: boolean } {
    if (!this.dialNumber.trim()) return { preview: null, error: null, valid: false };

    if (!this.isE164Shaped()) {
      const error = this.dialNumber.trim().startsWith('+')
        ? 'Enter a valid international number, e.g. +13055550100.'
        : `Enter a valid number for ${this.selectedDialCode} (7\u201315 digits).`;
      return { preview: null, error, valid: false };
    }

    const full = this.buildDialString();

    let possible = false;
    try { possible = isPossiblePhoneNumber(full); } catch { possible = false; }
    if (!possible) return { preview: null, error: null, valid: false };

    let valid = false;
    try { valid = isValidPhoneNumber(full); } catch { valid = false; }
    if (!valid) {
      return { preview: null, error: `This number doesn't look valid for ${this.selectedDialCode} -- check the digit count.`, valid: false };
    }

    return { preview: full, error: null, valid: true };
  }

  /**
   * True once the number is E.164-shaped AND libphonenumber-js recognizes
   * it as a real, dialable number for its country. This is what actually
   * gates the dial button.
   */
  get isValidDialNumber(): boolean {
    return this.dialValidationState.valid;
  }

  /**
   * Live preview of the exact E.164 number that will be dialed, shown
   * under the input so the agent can confirm it before hitting call.
   */
  get dialPreview(): string | null {
    return this.dialValidationState.preview;
  }

  get dialNumberError(): string | null {
    return this.dialValidationState.error;
  }

  /**
   * Sanitizes manual typing/paste into the national-number field --
   * strips everything but digits so a pasted "(305) 555-0100" or
   * "305-555-0100" still works instead of failing validation outright.
   * Keeps `dialNumber` as the single source of truth (always clean
   * digits), same as what appendDigit()/clearLastDigit() already assume.
   */
  onDialNumberInput(value: string): void {
    // Strip tel: URI prefix if user pastes from a contact link
    let cleaned = value.trim();
    if (cleaned.toLowerCase().startsWith('tel:')) {
      cleaned = cleaned.slice(4).trim();
    }

    // Respect a leading '+' (user pasting a full E.164 number themselves,
    // handled separately by buildDialString()) -- otherwise strip to digits only.
    this.dialNumber = cleaned.startsWith('+')
      ? '+' + cleaned.replace(/[^\d]/g, '')
      : cleaned.replace(/\D/g, '');

    // Auto-detect country code when the user types/pastes a full E.164 number
    if (this.dialNumber.startsWith('+') && this.dialNumber.length > 2) {
      const { iso2, national } = splitE164(this.dialNumber, this.selectedCountryIso2);
      if (iso2 !== this.selectedCountryIso2) {
        this.selectedCountryIso2 = iso2;
        // Replace the raw value with just the national part so the country
        // code picker and the digits field stay in sync
        this.dialNumber = national;
      }
    }
  }

  keypad = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ];

  /**
   * Real example number for the selected country, pulled from
   * libphonenumber-js's own metadata (examples.mobile.json) rather than
   * hand-maintained -- stays consistent with whatever validates the
   * input, and covers every country in COUNTRY_CODES without needing a
   * separate lookup table. Digits only, since dialNumber is plain digits
   * (no formatting) throughout this component.
   */
  get phoneNumberPlaceholder(): string {
    try {
      const example = getExampleNumber(this.selectedCountryIso2 as any, examples as any);
      if (example) return example.nationalNumber;
    } catch {
      // fall through to generic placeholder below
    }
    return '3055550100';
  }

  onClientSearchChange(term: string): void {
    this.clientSearch = term;
    this.contactHighlightIndex = -1; // list will change once fetchAdminClients resolves
    if (this.clientSearchDebounce) clearTimeout(this.clientSearchDebounce);
    this.clientSearchDebounce = setTimeout(() => {
      this.voiceService.fetchAdminClients(term);
    }, 300);
  }

  /** Options for the "Calling From (DID)" custom dropdown, built from synced voice_numbers. */
  get numberOptions(): SelectOption[] {
    return this.voiceService.voiceNumbers().map(n => ({
      value: n.id,
      label: `${n.phone_number}${n.label ? ' — ' + n.label : ''}${!n.is_active ? ' (inactive)' : ''}`,
    }));
  }

  onSelectClient(orgId: number | string): void {
    const id = Number(orgId);
    const client = this.voiceService.adminClients().find(c => c.orgId === id);
    if (!client) {
      this.selectedClientOrgId = null;
      return;
    }
    this.selectedClientOrgId = client.orgId;
    this.applyFullNumber(client.phoneNumber || '');
    this.customerNameInput = client.name || '';
    this.contactPickerOpen = false;
    this.clientSearch = '';
  }

  /**
   * Prefills the dialer from the last outbound number this session (does
   * NOT auto-dial -- same reasoning as the client picker: let the agent
   * see/edit before committing to a call, rather than blind-firing one
   * off a single click).
   */
  redialLast(): void {
    const last = this.voiceService.lastDialedNumber();
    if (!last) return;
    this.selectedClientOrgId = null;
    this.applyFullNumber(last.number);
    this.customerNameInput = last.name || '';
  }

  ngOnInit(): void {
    // Registration is deferred to ngAfterViewInit so the audio element exists first
    this.voiceService.registerSoftphone(); // registers once, stays alive
    // Pre-fill from ?orgId=&number=&name= when navigated here from the
    // Clients tab's "Call" button (see clients.ts -> callClient()).
    const qp = this.route.snapshot.queryParamMap;
    const orgId = qp.get('orgId');
    const number = qp.get('number');
    const name = qp.get('name');
    if (orgId) this.selectedClientOrgId = Number(orgId);
    if (number) this.applyFullNumber(number);
    if (name) this.customerNameInput = name;

    // Strip the query params from the URL right after applying them --
    // otherwise they stay in the address bar, and any later reload or
    // revisit of this exact URL (not just the original navigation from
    // the Clients tab) re-runs this same prefill with nothing actually
    // clicked. replaceUrl so this doesn't add a junk entry to browser
    // history that would just re-trigger the same thing on "back".
    if (orgId || number || name) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }

    // Fetch recent outbound calls for the quick-access strip
    this.voiceService.fetchRecentCalls();

    // Fetch Telnyx balance from backend proxy (API key stays on the server)
    this.voiceService.fetchTelnyxBalance();
  }

  ngAfterViewInit(): void {
    if (this.remoteAudioRef?.nativeElement) {
      this.voiceService.setRemoteAudioElement(this.remoteAudioRef.nativeElement);
    }

    // Auto-focus the phone input so users can start typing immediately
    setTimeout(() => {
      this.phoneInputRef?.nativeElement?.focus();
    }, 100);
  }
  ngOnDestroy(): void {
    // this.voiceService.unregister();
  }

  appendDigit(digit: string): void {
    this.dialNumber += digit;
  }

  clearLastDigit(): void {
    if (this.dialNumber.length > 0) {
      this.dialNumber = this.dialNumber.slice(0, -1);
    }
  }

  clearDialNumber(): void {
    this.dialNumber = '';
    this.customerNameInput = '';
  }

  /**
   * Live-formatted display of the dial number using libphonenumber-js's
   * AsYouType formatter. Groups digits like "812 345 6789" instead of
   * a flat string, making errors easier to spot before dialing.
   * Returns raw digits when the number is too short for formatting.
   */
  get formattedDialNumber(): string {
    const raw = this.dialNumber;
    if (!raw || raw.length < 2) return raw;
    try {
      const formatter = new AsYouType(this.selectedCountryIso2 as any);
      const result = formatter.input(raw);
      return result || raw;
    } catch {
      return raw;
    }
  }

  /** Pre-fill the dialer from a recent call chip click. */
  dialRecent(recent: { number: string; name: string }): void {
    this.selectedClientOrgId = null;
    this.applyFullNumber(recent.number);
    this.customerNameInput = recent.name || '';
  }

  /** Open/closed state for the "Recent calls" popover (bespoke dropdown, same pattern as the country/contact pickers -- lets each row show a copy button, which a generic SingleInput option can't). */
  recentCallsDropdownOpen = false;
  @ViewChild('recentCallsPickerRef') recentCallsPickerRef?: ElementRef<HTMLElement>;

  toggleRecentCallsDropdown(): void {
    this.recentCallsDropdownOpen = !this.recentCallsDropdownOpen;
    if (this.recentCallsDropdownOpen) {
      this.countryDropdownOpen = false;
      this.contactPickerOpen = false;
    }
  }

  /**
   * Copies a phone number to the clipboard and confirms via the same
   * toast (WebRtcVoiceService.notify()) the call-lifecycle events use.
   * Takes the triggering click event so it can stop propagation when the
   * copy icon sits inside a clickable row (recent calls, contact picker)
   * -- otherwise clicking "copy" would also fire that row's own click
   * handler (redial/select).
   */
  async copyNumber(number: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number);
      this.voiceService.notify('Number copied', 'success');
    } catch {
      this.voiceService.notify('Could not copy — copy it manually', 'error');
    }
  }
  /** Whether the keyboard shortcuts cheat sheet ('?') is showing. */
  showShortcutsModal = false;

  /**
   * Global keyboard shortcuts for power-user dialing:
   * - Enter → start call (when idle and valid)
   * - Escape → end/decline the live call if one exists, otherwise clear the dial input
   * - Backspace → delete the last digit
   * - M → toggle mute (only while actually on a call)
   * - H → toggle hold (only while actually on a call)
   * - R → redial last number (only when idle and a last number exists)
   * - 0-9, *, # → append digit (only when no other input is focused)
   * - ? → show this list
   */
  @HostListener('document:keydown', ['$event'])
  onKeyboardShortcut(event: KeyboardEvent): void {
    // While the cheat sheet is open, only Escape (close it) does anything --
    // otherwise a stray digit press would dial into the background field
    // while the modal is up.
    if (this.showShortcutsModal) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.showShortcutsModal = false;
      }
      return;
    }

    // Don't intercept when user is typing in another input/textarea
    // (except our own phone input, which should allow digit shortcuts)
    const target = event.target as HTMLElement;
    const isInOtherInput =
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) &&
      target !== this.phoneInputRef?.nativeElement;

    const activeCall = this.voiceService.activeCall();

    if (event.key === 'Enter' && !isInOtherInput) {
      event.preventDefault();
      if (!activeCall) this.onMakeCall();
      return;
    }

    // Escape works regardless of focus (same as before -- a global
    // "get me out of this" key), just repurposed: on a live call it ends
    // the call instead of touching the dial input, since clearing the
    // number mid-call wouldn't do anything useful. Only clears/focuses
    // the input when there's nothing to hang up.
    if (event.key === 'Escape') {
      event.preventDefault();
      if (activeCall) {
        if (activeCall.status === 'ringing' && activeCall.direction === 'inbound') {
          this.voiceService.rejectCall();
        } else {
          this.voiceService.hangupCall();
        }
      } else {
        this.clearDialNumber();
        this.phoneInputRef?.nativeElement?.focus();
      }
      return;
    }

    if (event.key === 'Backspace') {
      if (isInOtherInput) return; // let text fields (country/contact search, contact name) handle their own backspace
      if (target === this.phoneInputRef?.nativeElement) return; // native input backspace already updates dialNumber via onDialNumberInput()
      event.preventDefault();
      this.clearLastDigit();
      return;
    }

    if (event.key === '?' && !isInOtherInput) {
      event.preventDefault();
      this.showShortcutsModal = true;
      return;
    }

    if (!isInOtherInput && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Mute toggle -- only means anything while actually on a call.
      if (event.key.toLowerCase() === 'm' && activeCall && (activeCall.status === 'active' || activeCall.status === 'held')) {
        event.preventDefault();
        this.voiceService.toggleMute();
        return;
      }

      // Hold/resume toggle -- same active-call gate as mute above.
      if (event.key.toLowerCase() === 'h' && activeCall && (activeCall.status === 'active' || activeCall.status === 'held')) {
        event.preventDefault();
        this.voiceService.toggleHold();
        return;
      }

      // Redial last number -- idle only (same guard as Enter's start-call
      // branch above), and only if there's actually a number to redial.
      if (event.key.toLowerCase() === 'r' && !activeCall && this.voiceService.lastDialedNumber()) {
        event.preventDefault();
        this.redialLast();
        return;
      }

      const dialKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'];
      if (dialKeys.includes(event.key)) {
        event.preventDefault();
        this.appendDigit(event.key);
        // Auto-focus the phone input so the cursor stays there
        this.phoneInputRef?.nativeElement?.focus();
      }
    }
  }

  /**
   * Dynamic label for the dial button so a disabled state actually tells
   * the agent why, instead of just going to 50% opacity with the same
   * "Start Outbound Call" text regardless of which of the three possible
   * blockers applies.
   */
  get dialButtonLabel(): string {
    if (this.voiceService.connectionState() !== 'Registered') return 'Register softphone to call';
    if (this.voiceService.activeCall()) return 'Already on a call';
    if (!this.dialNumber.trim()) return 'Enter a number to call';
    if (!this.isValidDialNumber) return 'Enter a valid number';
    return 'Start Outbound Call';
  }

  onMakeCall(): void {
    const trimmed = this.dialNumber.trim();
    if (!trimmed) {
      this.voiceService.errorMessage.set('Enter a phone number to call.');
      return;
    }
    if (!this.isValidDialNumber) {
      this.voiceService.errorMessage.set(this.dialNumberError || 'Enter a valid phone number.');
      return;
    }
    const fullNumber = this.buildDialString();
    if (fullNumber === this.voiceService.selectedCallerNumber) {
      this.voiceService.errorMessage.set('You cannot call your own outbound number.');
      return;
    }
    this.voiceService.makeOutboundCall(fullNumber, this.customerNameInput);
  }

  refreshAdminClients(): void {
    this.voiceService.fetchAdminClients(this.clientSearch);
  }

  simulateIncomingCall(): void {
    const mockId = Math.floor(Math.random() * 1000) + 100;
    this.voiceService.receiveIncomingCall(mockId, '+18005550199', 'Sarah Jenkins (TechGlobal)');
  }

  /**
   * True when there's a problem that should be shown inline near the
   * dial button — mic denied/blocked or softphone not registered.
   */
  get hasInlineWarning(): boolean {
    return (
      this.voiceService.micPermission() === 'Denied' ||
      this.voiceService.micPermission() === 'Blocked' ||
      this.voiceService.connectionState() === 'Disconnected' ||
      this.voiceService.connectionState() === 'error'
    );
  }

  get inlineWarningMessage(): string {
    if (this.voiceService.micPermission() === 'Denied' || this.voiceService.micPermission() === 'Blocked') {
      return 'Mic access required to place calls';
    }
    if (this.voiceService.connectionState() === 'Disconnected' || this.voiceService.connectionState() === 'error') {
      return 'Softphone not connected — register first';
    }
    return '';
  }

  /** The enhanced label for the "Calling From" DID display */
  get selectedNumberLabel(): string {
    const n = this.voiceService.voiceNumbers().find(v => v.id === this.voiceService.selectedNumberId());
    return n?.label || '';
  }

  get selectedNumberFormatted(): string {
    const n = this.voiceService.voiceNumbers().find(v => v.id === this.voiceService.selectedNumberId());
    if (!n) return '';
    try {
      const formatter = new AsYouType();
      return formatter.input(n.phone_number) || n.phone_number;
    } catch {
      return n.phone_number;
    }
  }
}
