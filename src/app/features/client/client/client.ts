import {
  Component,
  HostListener,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { DataTable } from '../../../shared/components/Data-table/data-table';
import { CustomColumnDirective } from '../../../shared/components/Data-table/custom-column.directive';
import {
  BulkAction,
  RequestContext,
  SmartColumn,
  SmartTableConfig,
} from '../../../shared/components/Data-table/data-table.types';
import { ClientService, SendWelcomeMailPayload } from '../services/client/client';
import { Datum } from '../models/client/client.model';
import { ActivatedRoute, Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { ScheduleMeetingService } from '../../meetings/schedule-meeting/schedule-meetings.service';
import { FormsModule } from '@angular/forms';
import { RichTextEditor } from '../../../shared/components/rich-text-editor/rich-text-editor';
import { Clienttimeline } from '../services/client/clienttimeline';
import { ClientTimelineData } from '../models/client/clienttimeline.model';
import { AuthService } from '../../../core/services/auth-service';

export interface ClientRow {
  orgId: number;
  name: string;
  planStart: string;
  planEnd: string;
  premiumDate: string;
  userLimit: number;
  modules: string;
  leadOwner: string;
  supportOwner: string;
  progress: number;
  stage: string;
  trainingStatus: number;
  trainingProgress: number;
  contactPerson: string;
  email: string;
  phoneNumber: string;
  country: string;
}

export interface TimelineEvent {
  date: string;
  year: string;
  title: string;
  description: string;
  status: 'success' | 'warning' | 'danger';
  current?: boolean;
}

@Component({
  selector: 'app-client',
  imports: [DataTable, CustomColumnDirective, NgClass, FormsModule, RichTextEditor],
  templateUrl: './client.html',
  styleUrl: './client.css',
})
export class Client implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private clientApi = inject(ClientService);
  private scheduleMeetingService = inject(ScheduleMeetingService);
  private toastr = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly tableEndpoint = `${this.clientApi.baseUrl}/clientDataTable`;
  private clientTimelineApi = inject(Clienttimeline);
  readonly clientFilterNames = ['leadOwner', 'supportOwner'];
  statusFilter = signal<string>('all');

  initialDateFrom = signal('');
  initialDateTo = signal('');

  // ── Send Mail modal ──────────────────────────────────────────────────────
  mailModalOpen = signal(false);
  mailModalRow = signal<ClientRow | null>(null);
  mailTab = signal<'edit' | 'preview'>('edit');
  mailRecipients = signal<string[]>([]);
  mailRecipientInput = '';
  mailSubject = '';
  mailBody = '';
  mailSending = signal(false);
  timelineLoading = signal(false);
  timelineError = signal('');

  openMailModal(row: ClientRow): void {
    this.closeActionMenu();
    this.mailModalRow.set(row);
    this.mailTab.set('edit');
    this.mailRecipients.set(row.email ? [row.email.trim()] : []);
    this.mailSubject = `Welcome to UbiClient, ${row.name}!`;
    this.mailBody =
      `<p>Hi ${row.contactPerson || row.name},</p>` +
      `<p>Welcome aboard! We're excited to have ${row.name} on UbiClient. Your account has been set up and the portal is ready whenever you are.</p>` +
      `<p>Best,<br>The UbiClient Team</p>`;
    this.mailModalOpen.set(true);
  }

  onEditorChange(html: string): void {
    this.mailBody = html;
  }

  recipientInputInvalid = signal(false);
  private emailAutoCommitTimer: any = null;
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  closeMailModal(): void {
    if (this.emailAutoCommitTimer) {
      clearTimeout(this.emailAutoCommitTimer);
      this.emailAutoCommitTimer = null;
    }
    this.mailModalOpen.set(false);
    this.mailRecipientInput = '';
    this.mailAttachments.set([]);
    this.attachmentError.set('');
    this.recipientInputInvalid.set(false);
  }

  commitRecipientInput(raw?: string): boolean {
    if (this.emailAutoCommitTimer) {
      clearTimeout(this.emailAutoCommitTimer);
      this.emailAutoCommitTimer = null;
    }

    const text = (raw !== undefined ? raw : this.mailRecipientInput).trim();
    if (!text) {
      this.recipientInputInvalid.set(false);
      return false;
    }

    const candidates = text.split(/[,;\s\n]+/).filter(Boolean);
    const current = this.mailRecipients();
    const toAdd: string[] = [];
    let hasInvalid = false;

    for (const email of candidates) {
      const clean = email.trim().replace(/[,;]$/, '');
      if (!this.emailRegex.test(clean)) {
        hasInvalid = true;
        continue;
      }
      if (!current.includes(clean) && !toAdd.includes(clean)) {
        toAdd.push(clean);
      }
    }

    if (toAdd.length > 0) {
      this.mailRecipients.update((list) => [...list, ...toAdd]);
      this.mailRecipientInput = '';
      this.recipientInputInvalid.set(false);
      return true;
    }

    if (hasInvalid && candidates.length > 0) {
      this.recipientInputInvalid.set(true);
      return false;
    }

    this.mailRecipientInput = '';
    this.recipientInputInvalid.set(false);
    return false;
  }

  onRecipientInputChange(value: string): void {
    this.mailRecipientInput = value;
    this.recipientInputInvalid.set(false);

    if (this.emailAutoCommitTimer) {
      clearTimeout(this.emailAutoCommitTimer);
      this.emailAutoCommitTimer = null;
    }

    // If input contains delimiters (comma, semicolon, space, newline), commit immediately
    if (/[,;\s\n]/.test(value)) {
      this.commitRecipientInput(value);
      return;
    }

    const trimmed = value.trim();
    // If it's a complete valid email (e.g. name@domain.com), auto-commit after a brief pause
    if (this.emailRegex.test(trimmed)) {
      this.emailAutoCommitTimer = setTimeout(() => {
        if (this.emailRegex.test(this.mailRecipientInput.trim())) {
          this.commitRecipientInput(this.mailRecipientInput);
        }
      }, 600);
    }
  }

  onRecipientKeyDown(event: KeyboardEvent): void {
    if (['Enter', 'Tab', ',', ';', ' '].includes(event.key)) {
      const val = this.mailRecipientInput.trim();
      if (val) {
        event.preventDefault();
        this.commitRecipientInput(val);
      }
    }
  }

  onRecipientPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text');
    if (text && (text.includes('@') || /[,;\s\n]/.test(text))) {
      event.preventDefault();
      this.commitRecipientInput(text);
    }
  }

  onRecipientBlur(): void {
    if (this.mailRecipientInput.trim()) {
      this.commitRecipientInput();
    }
  }

  addRecipient(event?: Event): void {
    if (event) event.preventDefault();
    this.commitRecipientInput();
  }

  removeRecipient(email: string): void {
    this.mailRecipients.update((list) => list.filter((e) => e !== email));
  }

  sendCustomMail(): void {
    const row = this.mailModalRow();
    if (!row) return;

    // Auto-commit any valid email in the input before sending
    if (this.mailRecipientInput.trim()) {
      this.commitRecipientInput();
    }

    if (this.mailRecipients().length === 0) {
      this.toastr.warning('Add at least one recipient.', 'Warning');
      return;
    }

    const empId = localStorage.getItem('empId');
    if (!empId) {
      this.toastr.error('Host employee ID not found. Please log in again.', 'Error');
      return;
    }

    this.mailSending.set(true);

    this.scheduleMeetingService.getEmployeeDetails(empId).subscribe({
      next: (details) => {
        const hostEmail = details?.currentMail;
        if (!hostEmail) {
          this.mailSending.set(false);
          this.toastr.error('Host email not found for the logged-in user.', 'Error');
          return;
        }

        this.clientApi
          .sendCustomMail({
            hostEmail,
            toEmails: this.mailRecipients(),
            subject: this.mailSubject,
            message: this.mailBody,
            companyName: row.name,
            orgId: row.orgId,
            empId: empId,
            attachments: this.mailAttachments().map(({ name, contentType, contentBytes }) => ({
              name,
              contentType,
              contentBytes,
            })),
          })
          .subscribe({
            next: (res) => {
              this.mailSending.set(false);
              if (res?.status) {
                this.toastr.success(res.message || 'Email sent!', 'Success');
                this.closeMailModal();
              } else {
                this.toastr.error(res?.message || 'Failed to send email.', 'Error');
              }
            },
            error: (err) => {
              this.mailSending.set(false);
              this.toastr.error(err?.error?.message || 'Failed to send email.', 'Error');
            },
          });
      },
      error: () => {
        this.mailSending.set(false);
        this.toastr.error('Failed to fetch host details.', 'Error');
      },
    });
  }

  private getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const from = params.get('from');
      const to = params.get('to');
      if (from && to) {
        this.initialDateFrom.set(from);
        this.initialDateTo.set(to);
      }
    });
    this.loadData();
    document.addEventListener('scroll', this.closeActionMenuOnScroll, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.closeActionMenuOnScroll, true);
  }

  loadData() {}

  openClientDetails(client: ClientRow) {}

  sendingMailRowId = signal<number | null>(null);
  mailSuccessRowId = signal<number | null>(null);

  actionMenuOpenRowId = signal<number | null>(null);
  actionMenuRow = signal<ClientRow | null>(null);
  actionMenuPosition = signal<{ top: number; left: number } | null>(null);

  toggleActionMenu(row: ClientRow, event: MouseEvent): void {
    event.stopPropagation();

    if (this.actionMenuOpenRowId() === row.orgId) {
      this.closeActionMenu();
      return;
    }

    const trigger = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 175;

    // If there is not enough room below the trigger, open above it
    const fitsBelow = trigger.bottom + menuHeight + 8 <= window.innerHeight;
    const top = fitsBelow ? trigger.bottom + 6 : Math.max(8, trigger.top - menuHeight - 6);

    const left = Math.max(
      8,
      Math.min(trigger.right - menuWidth, window.innerWidth - menuWidth - 8),
    );

    this.actionMenuOpenRowId.set(row.orgId);
    this.actionMenuRow.set(row);
    this.actionMenuPosition.set({ top, left });
  }

  closeActionMenu(): void {
    this.actionMenuOpenRowId.set(null);
    this.actionMenuRow.set(null);
    this.actionMenuPosition.set(null);
  }

  private closeActionMenuOnScroll = () => {
    if (this.actionMenuOpenRowId() !== null && this.sendingMailRowId() === null) {
      this.closeActionMenu();
    }
  };

  @HostListener('document:click')
  onDocumentClickCloseActionMenu(): void {
    if (this.actionMenuOpenRowId() !== null && this.sendingMailRowId() === null) {
      this.closeActionMenu();
    }
  }

  @HostListener('window:resize')
  onWindowResizeCloseActionMenu(): void {
    if (this.actionMenuOpenRowId() !== null && this.sendingMailRowId() === null) {
      this.closeActionMenu();
    }
  }

  // ── Client Timeline drawer ──────────────────────────────────────────────
  timelineDrawerOpen = signal(false);
  timelineDrawerRow = signal<ClientRow | null>(null);
  timelineEvents = signal<TimelineEvent[]>([]);

  openClientTimeline(row: ClientRow): void {
    this.timelineDrawerRow.set(row);
    this.timelineDrawerOpen.set(true);
    this.closeActionMenu();
    this.loadClientTimeline(row);
  }

  closeTimelineDrawer(): void {
    this.timelineDrawerOpen.set(false);
  }

  private loadClientTimeline(row: ClientRow): void {
    this.timelineLoading.set(true);
    this.timelineError.set('');
    this.timelineEvents.set([]);

    this.clientTimelineApi.getClientTimeline({ orgId: String(row.orgId) }).subscribe({
      next: (res) => {
        this.timelineLoading.set(false);
        if (res?.status) {
          this.timelineEvents.set(this.buildTimelineFromApi(res.data, row));
        } else {
          this.timelineError.set(res?.msg || 'Failed to load timeline');
        }
      },
      error: (err) => {
        this.timelineLoading.set(false);
        this.timelineError.set(err?.error?.msg || 'Failed to load timeline');
      },
    });
  }

  private buildTimelineFromApi(data: ClientTimelineData, row: ClientRow): TimelineEvent[] {
    // Reversed order: Go Live -> Setup -> Kickoff Meeting -> Welcome Email Sent
    return [
      {
        date: '',
        year: '',
        title: 'Go Live',
        description: 'System is live and in production.',
        status: data.goLive ? 'success' : 'warning',
      },
      {
        date: '',
        year: '',
        title: 'Setup',
        description: `Company setup completed, including organization profile, HRMS configuration, and admin user creation for ${row.name}.`,
        status: data.setup ? 'success' : 'warning',
      },
      {
        date: '',
        year: '',
        title: 'Kickoff Meeting',
        description: 'Initial kickoff meeting completed with the team.',
        status: data.kickoffMeeting ? 'success' : 'warning',
      },
      {
        date: '',
        year: '',
        title: 'Welcome Email Sent',
        description: `Welcome email and portal access sent to ${row.contactPerson || row.name}.`,
        status: data.welcomeEmailSent ? 'success' : 'warning',
      },
    ];
  }

  onClientMenuAction(action: string, row: ClientRow): void {
    console.log(`${action}:`, row.orgId);

    if (action === 'Meeting Schedule') {
      this.closeActionMenu();
      this.router.navigate(['/meetings/schedule'], {
        queryParams: {
          orgName: row.name,
          email: row.email,
          orgId: row.orgId,
        },
      });
    } else if (action === 'View Client') {
      this.closeActionMenu();
      this.router.navigate(['/client/client-dashboard'], {
        queryParams: {
          orgId: row.orgId,
          orgName: row.name,
        },
      });
    } else if (action === 'Send Mail') {
      this.openMailModal(row);
    } else if (action === 'Client Timeline') {
      this.openClientTimeline(row);
    } else {
      this.closeActionMenu();
    }
  }

  private sendWelcomeMail(row: ClientRow): void {
    if (!row.email || !row.email.trim()) {
      this.toastr.warning('Client does not have a registered email address.', 'Warning');
      this.closeActionMenu();
      return;
    }

    const empId = localStorage.getItem('empId');
    if (!empId) {
      this.toastr.error('Host employee ID not found. Please log in again.', 'Error');
      this.closeActionMenu();
      return;
    }

    this.sendingMailRowId.set(row.orgId);
    this.mailSuccessRowId.set(null);

    this.scheduleMeetingService.getEmployeeDetails(empId).subscribe({
      next: (details) => {
        const hostEmail = details?.currentMail;
        if (!hostEmail) {
          this.sendingMailRowId.set(null);
          this.toastr.error('Host email not found for the logged-in user.', 'Error');
          this.closeActionMenu();
          return;
        }

        const payload: SendWelcomeMailPayload = {
          hostEmail: hostEmail,
          toEmail: row.email.trim(),
          companyName: row.name || '',
          contactName: row.contactPerson || row.name || '',
        };

        this.clientApi.sendWelcomeMail(payload).subscribe({
          next: (res) => {
            this.sendingMailRowId.set(null);
            if (res?.status) {
              this.mailSuccessRowId.set(row.orgId);
              this.toastr.success(res.message || 'Welcome email sent successfully!', 'Success');
              setTimeout(() => {
                this.mailSuccessRowId.set(null);
                this.closeActionMenu();
              }, 2000);
            } else {
              this.toastr.error(res?.message || 'Failed to send welcome email.', 'Error');
              this.closeActionMenu();
            }
          },
          error: (err) => {
            this.sendingMailRowId.set(null);
            const errMsg = err?.error?.message || err?.message || 'Failed to send welcome email.';
            this.toastr.error(errMsg, 'Error');
            this.closeActionMenu();
          },
        });
      },
      error: (err) => {
        this.sendingMailRowId.set(null);
        const errMsg = err?.error?.message || err?.message || 'Failed to fetch host details.';
        this.toastr.error(errMsg, 'Error');
        this.closeActionMenu();
      },
    });
  }

  private mapDatumToClientRow(raw: Datum): ClientRow {
    return {
      orgId: raw.orgId,
      name: raw.client,
      planStart: String(raw.planStart),
      planEnd: String(raw.planEnd),
      premiumDate: String(raw.premiumDate),
      userLimit: raw.userLimit,
      modules: raw.module,
      leadOwner: raw.leadOwner,
      supportOwner:
        raw.supportOwner && String(raw.supportOwner) !== '-' ? String(raw.supportOwner) : '—',
      progress: raw.progress,
      stage: raw.stage,
      trainingStatus: raw.trainingStatus,
      trainingProgress: raw.trainingProgress,
      contactPerson: raw.contactPerson,
      email: raw.email,
      phoneNumber: raw.phoneNumber,
      country: raw.country,
    };
  }

  // ── Bulk action handlers ────────────────────────────────────────────────
  private markImplementation(rows: ClientRow[], status: 'Pending' | 'Completed'): void {
    const ids = rows.map((r) => r.orgId);
    console.log(`Mark ${status}:`, ids);
  }

  private exportSelected(rows: ClientRow[]): void {
    console.log(
      'Export selected:',
      rows.map((r) => r.orgId),
    );
  }

  private deleteSelected(rows: ClientRow[]): void {
    const ids = rows.map((r) => r.orgId);
    console.log('Delete:', ids);
  }

  get bulkActions(): BulkAction<ClientRow>[] {
    return [
      {
        id: 'markCompleted',
        label: 'Mark Completed',
        icon: 'check',
        color: '#10b981',
        // now based on progress percentage instead of a status string
        hidden: (rows) => rows.every((r) => r.progress === 100),
        onClick: (rows) => this.markImplementation(rows, 'Completed'),
      },
      {
        id: 'markPending',
        label: 'Mark Pending',
        icon: 'circle-dot',
        color: '#f59e0b',
        hidden: (rows) => rows.every((r) => r.progress === 0),
        onClick: (rows) => this.markImplementation(rows, 'Pending'),
      },
      {
        id: 'exportSelected',
        label: 'Export Selected',
        icon: 'download',
        color: '#3b82f6',
        onClick: (rows) => this.exportSelected(rows),
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'delete',
        color: '#ef4444',
        disabled: (rows) => rows.some((r) => r.stage === 'PREMIUM'),
        onClick: (rows) => this.deleteSelected(rows),
      },
    ];
  }

  tableConfig = computed<SmartTableConfig<ClientRow>>(() => {
    const statusFilter = this.statusFilter();

    return {
      columns: [
        { key: 'name', label: 'Client', sortable: true, hideable: true },
        { key: 'contactPerson', label: 'Contact Name', sortable: true },
        { key: 'email', label: 'Email', sortable: false },
        { key: 'phoneNumber', label: 'Phone', sortable: false },
        { key: 'country', label: 'Country', sortable: false },
        { key: 'planStart', label: 'Plan Start', sortable: true, hideable: false, type: 'date' },
        { key: 'planEnd', label: 'Plan End', sortable: true, hideable: false, type: 'date' },
        { key: 'premiumDate', label: 'Premium Date', sortable: true, hideable: false, type: 'date' },
        { key: 'userLimit', label: 'User Limit', sortable: true },
        { key: 'modules', label: 'Modules', sortable: false },
        { key: 'leadOwner', label: 'Lead Owner', sortable: false },
        { key: 'supportOwner', label: 'Support Owner', sortable: false },
        // { key: 'progress', label: 'Implementation', sortable: false },
        // { key: 'trainingStatus', label: 'Training', sortable: false },
        { key: 'action', label: 'Action', sortable: false, sticky: true },
      ] as SmartColumn<ClientRow>[],

      apiConfig: {
        endpoint: this.tableEndpoint,
        dataPath: 'data',
        totalPath: 'totalRecords',

        buildRequest: (ctx: RequestContext) => {
          const filterObj: Record<string, any> = { ...ctx.filters };
          const today = this.getTodayDateString();
          const fromDate = ctx.dateFrom ? ctx.dateFrom : today;
          const toDate = ctx.dateTo ? ctx.dateTo : today;

          const sortColMap: Record<string, string> = {
            name: 'client',
            planStart: 'planStart',
            planEnd: 'planEnd',
            userLimit: 'userLimit',
            stage: 'stage',
            modules: 'module',
            leadOwner: 'leadOwner',
            supportOwner: 'suppOwner',
            contactPerson: 'contactPerson',
            premiumDate: 'premiumDate',
          };
          const sortCol = ctx.sortKey ? (sortColMap[ctx.sortKey] ?? ctx.sortKey) : 'client';

          const body = {
            start: ctx.page * ctx.pageSize,
            length: ctx.pageSize,
            search: ctx.search ?? '',
            sorting: JSON.stringify({
              require: ctx.sortKey ? 1 : 0,
              col: sortCol,
              dir: ctx.sortDir ?? 'asc',
            }),
            filter: JSON.stringify(filterObj),
            fromDate,
            toDate,
           orgId: this.authService.getOrgId(),
            userId: this.authService.getEmpId(),
            adminSts: Number(this.authService.adminSts())

          };

          return { method: 'POST' as const, body };
        },




        transformRow: (raw: Datum): ClientRow | null => this.mapDatumToClientRow(raw),
      },

      rowIdKey: 'orgId',
      showSearch: true,
      showPagination: true,
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100, 500],
      exportFileName: 'client',
      emptyMessage: 'No client records found.',
      clickable: true,

      toolbarButtons: [
        { id: 'date', type: 'datePicker' as const, label: 'Date' },
        { id: 'filter', type: 'filter', label: 'Filter' },
        { id: 'export', type: 'export', label: 'Export' },
        { id: 'refresh', type: 'refresh' },
        { id: 'columns', type: 'columnPicker', label: 'Columns' },
      ],
    };
  });

  mailAttachments = signal<
    { name: string; size: number; contentType: string; contentBytes: string }[]
  >([]);
  attachmentError = signal('');

  private readonly MAX_ATTACHMENT_MB = 3; // per-file limit
  private readonly MAX_TOTAL_MB = 10; // total across all files (Graph hard-caps ~25MB via API)

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    Array.from(input.files).forEach((file) => this.addAttachment(file));
    input.value = ''; // allow re-selecting the same file later
  }

  private addAttachment(file: File): void {
    this.attachmentError.set('');

    if (file.size > this.MAX_ATTACHMENT_MB * 1024 * 1024) {
      this.attachmentError.set(`${file.name} exceeds ${this.MAX_ATTACHMENT_MB}MB.`);
      return;
    }

    const currentTotal = this.mailAttachments().reduce((sum, a) => sum + a.size, 0);
    if (currentTotal + file.size > this.MAX_TOTAL_MB * 1024 * 1024) {
      this.attachmentError.set(`Total attachments can't exceed ${this.MAX_TOTAL_MB}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]; // strip the data:...;base64, prefix
      this.mailAttachments.update((list) => [
        ...list,
        {
          name: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
          contentBytes: base64,
        },
      ]);
    };
    reader.readAsDataURL(file);
  }

  removeAttachment(name: string): void {
    this.mailAttachments.update((list) => list.filter((a) => a.name !== name));
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
