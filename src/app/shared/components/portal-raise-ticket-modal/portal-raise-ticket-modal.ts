import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalIcon } from '../../portal-icon';

export interface UploadedAttachment {
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
}

@Component({
  selector: 'app-portal-raise-ticket-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalIcon],
  templateUrl: './portal-raise-ticket-modal.html',
  styleUrls: ['../portal-ui.css', './portal-raise-ticket-modal.css'],
})
export class PortalRaiseTicketModal {
  private portalService = inject(ClientPortalService);
  private toastr = inject(ToastrService);
  readonly state = inject(PortalState);

  subject = signal('');
  description = signal('');
  priority = signal<'low' | 'normal' | 'high' | 'urgent'>('normal');

  attachments = signal<UploadedAttachment[]>([]);
  isUploading = signal(false);
  isSubmitting = signal(false);
  errorMessage = signal('');

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.state.raiseTicketModalOpen()) {
      this.close();
    }
  }

  close(): void {
    if (this.isSubmitting()) return;
    this.state.closeRaiseTicket();
    this.resetForm();
  }

  resetForm(): void {
    this.subject.set('');
    this.description.set('');
    this.priority.set('normal');
    this.attachments.set([]);
    this.isUploading.set(false);
    this.isSubmitting.set(false);
    this.errorMessage.set('');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.size > 15 * 1024 * 1024) {
      this.errorMessage.set('File exceeds the 15 MB limit.');
      return;
    }

    this.isUploading.set(true);
    this.errorMessage.set('');

    this.portalService.uploadAttachment(file).subscribe({
      next: (res) => {
        this.isUploading.set(false);
        if (res?.status && res.data) {
          this.attachments.update((list) => [...list, res.data!]);
          input.value = '';
        } else {
          this.errorMessage.set(res?.msg || 'Failed to upload attachment.');
        }
      },
      error: (err) => {
        this.isUploading.set(false);
        this.errorMessage.set(err?.error?.msg || 'Attachment upload failed.');
      },
    });
  }

  removeAttachment(index: number): void {
    this.attachments.update((list) => list.filter((_, i) => i !== index));
  }

  submit(): void {
    const sub = this.subject().trim();
    const desc = this.description().trim();

    if (!sub) {
      this.errorMessage.set('Please provide a subject for your ticket.');
      return;
    }
    if (!desc) {
      this.errorMessage.set('Please describe the issue or request.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.portalService
      .createTicket({
        subject: sub,
        description: desc,
        priority: this.priority(),
        attachments: this.attachments(),
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          if (res?.status && res.data) {
            const uid = res.data.ticketUid;
            this.toastr.success(`Ticket ${uid} submitted successfully!`, 'Support Ticket Created');
            this.close();
            // Automatically open ticket list to show the new ticket
            this.state.openTicketsList();
          } else {
            this.errorMessage.set(res?.msg || 'Failed to submit ticket.');
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err?.error?.msg || 'Error submitting ticket. Please try again.');
        },
      });
  }
}