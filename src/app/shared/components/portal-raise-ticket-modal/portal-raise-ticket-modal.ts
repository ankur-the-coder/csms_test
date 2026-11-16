import { Component, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import { AuthService } from '../../../core/services/auth-service';
import { PortalState } from '../../../core/services/portal-state';
import { PortalIcon } from '../../portal-icon';
import { PortalScreenshotEditor } from '../portal-screenshot-editor/portal-screenshot-editor';

export interface UploadedAttachment {
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
}

/** Screenshot / screen recording captured in the browser. Kept locally for now (upload API comes later). */
export interface LocalCapture {
  id: number;
  kind: 'photo' | 'video';
  fileName: string;
  size: number;
  blob: Blob;
  url: string;
  safeUrl: SafeUrl;
  durationSec?: number;
}

const MAX_VIDEO_SEC = 60;
// Size budget: 1 min must stay under ~8 MB  =>  ~1.0 Mbps in total (video + audio), with a little headroom.
const VIDEO_BPS = 850_000;
const AUDIO_BPS = 64_000;
const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4',
];

@Component({
  selector: 'app-portal-raise-ticket-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalIcon, PortalScreenshotEditor],
  templateUrl: './portal-raise-ticket-modal.html',
  styleUrls: ['../portal-ui.css', './portal-raise-ticket-modal.css'],
})
export class PortalRaiseTicketModal implements OnDestroy {
  private portalService = inject(ClientPortalService);
  private toastr = inject(ToastrService);
  private sanitizer = inject(DomSanitizer);
  private auth = inject(AuthService);
  /** Files picked with 'Add File', kept locally until submit (key = UploadedAttachment.storagePath). */
  private pickedFiles = new Map<string, File>();
  readonly state = inject(PortalState);

  subject = signal('');
  description = signal('');

  attachments = signal<UploadedAttachment[]>([]);
  isUploading = signal(false);
  isSubmitting = signal(false);
  errorMessage = signal('');

  // ---- screen capture (photo / video) ----
  captures = signal<LocalCapture[]>([]);
  editing = signal<Blob | null>(null);   // screenshot being cropped / annotated
  capturing = signal(false);   // picking a screen / grabbing a frame
  recording = signal(false);
  hideModal = signal(false);   // modal tucks away while grabbing a frame
  elapsed = signal(0);
  readonly maxVideoSec = MAX_VIDEO_SEC;
  readonly captureSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  private seq = 0;
  private recorder: MediaRecorder | null = null;
  private streams: MediaStream[] = [];
  private audioCtx: AudioContext | null = null;
  private chunks: BlobPart[] = [];
  private timer: any = null;
  private startedAt = 0;
  private discard = false;

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.state.raiseTicketModalOpen() && !this.recording() && !this.editing()) {
      this.close();
    }
  }

  close(): void {
    if (this.isSubmitting()) return;
    this.cancelRecording();
    this.state.closeRaiseTicket();
    this.resetForm();
  }

  resetForm(): void {
    this.subject.set('');
    this.description.set('');
    this.editing.set(null);
    this.revokeAll();
    this.attachments.set([]);
    this.pickedFiles.clear();
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

    this.errorMessage.set('');
    const key = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.pickedFiles.set(key, file);
    this.attachments.update((list) => [...list, { fileName: file.name, contentType: file.type, size: file.size, storagePath: key }]);
    input.value = '';
  }

  removeAttachment(index: number): void {
    const gone = this.attachments()[index];
    if (gone) this.pickedFiles.delete(gone.storagePath);
    this.attachments.update((list) => list.filter((_, i) => i !== index));
  }

  // ================= Screen capture =================
  busy(): boolean { return this.capturing() || this.recording() || this.isSubmitting(); }

  private displayOptions(withAudio: boolean): any {
    return {
      // Photos stay full-resolution. Video is capped at 1080p / 24 fps: at ~1 Mbps this keeps text sharp,
      // and the capture only produces new frames when the screen actually changes (variable frame rate).
      video: withAudio
        ? { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 20, max: 24 }, cursor: 'always' }
        : { width: { ideal: 3840 }, height: { ideal: 2160 }, cursor: 'always' },
      audio: withAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000 } : false,
      selfBrowserSurface: 'include', systemAudio: 'include', surfaceSwitching: 'include',
    };
  }

  private stamp(): string {
    const d = new Date(), z = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
  }

  private addCapture(kind: 'photo' | 'video', blob: Blob, ext: string, durationSec?: number): void {
    const url = URL.createObjectURL(blob);
    this.captures.update((l) => [...l, {
      id: ++this.seq, kind, blob, url, durationSec, size: blob.size,
      safeUrl: this.sanitizer.bypassSecurityTrustUrl(url),
      fileName: `${kind === 'photo' ? 'screenshot' : 'recording'}-${this.stamp()}.${ext}`,
    }]);
  }

  /** Pick any tab / window / screen and save one full-resolution JPG frame. */
  async capturePhoto(): Promise<void> {
    if (this.busy() || !this.captureSupported) return;
    this.errorMessage.set('');
    let stream: MediaStream | null = null;
    this.capturing.set(true);
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(this.displayOptions(false));
      this.hideModal.set(true);                       // keep this dialog out of the screenshot
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 600));   // let the share picker fade out
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
      if (!blob) throw new Error('empty frame');
      this.editing.set(blob);                         // open the crop / highlight editor first
    } catch (e: any) {
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') this.errorMessage.set('Could not capture the screenshot. Please try again.');
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      this.hideModal.set(false);
      this.capturing.set(false);
    }
  }

  onEdited(blob: Blob): void { this.addCapture('photo', blob, 'jpg'); this.editing.set(null); }
  retakePhoto(): void { this.editing.set(null); void this.capturePhoto(); }

  /** Record any tab / window / screen (max 1 min) with tab/system audio and microphone mixed in. */
  async startVideo(): Promise<void> {
    if (this.busy() || !this.captureSupported) return;
    this.errorMessage.set('');
    this.capturing.set(true);
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia(this.displayOptions(true));
    } catch (e: any) {
      this.capturing.set(false);
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') this.errorMessage.set('Could not start the screen recording.');
      return;
    }
    this.streams = [display];
    // 'text' = screen content: encoder keeps resolution sharp and drops frames (not detail) when bits run short
    display.getVideoTracks().forEach((t) => ((t as any).contentHint = 'text'));
    try {
      // optional microphone (narration) - recording still works if denied
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        this.streams.push(mic);
      } catch { /* no mic */ }

      const tracks: MediaStreamTrack[] = [...display.getVideoTracks()];
      const audioSources = [display, mic].filter((s): s is MediaStream => !!s && s.getAudioTracks().length > 0);
      if (audioSources.length) {
        const ctx = new AudioContext();
        this.audioCtx = ctx;
        const dest = ctx.createMediaStreamDestination();
        audioSources.forEach((s) => ctx.createMediaStreamSource(s).connect(dest));
        tracks.push(...dest.stream.getAudioTracks());
      }

      const mime = VIDEO_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(new MediaStream(tracks), {
        ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: AUDIO_BPS,
        // long GOP: one key frame every 10 s, everything in between is stored as changes only (ignored where unsupported)
        videoKeyFrameIntervalDuration: 10_000,
      } as MediaRecorderOptions);
      this.recorder = rec; this.chunks = []; this.discard = false;
      rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
      rec.onstop = () => this.finishVideo(rec.mimeType || mime || 'video/webm');
      display.getVideoTracks()[0].addEventListener('ended', () => this.stopVideo()); // user clicked "Stop sharing"

      rec.start(1000);
      this.startedAt = Date.now();
      this.elapsed.set(0);
      this.recording.set(true);                         // modal tucks away, floating Stop pill appears
      this.timer = setInterval(() => {
        const ms = Date.now() - this.startedAt;
        this.elapsed.set(Math.min(MAX_VIDEO_SEC, Math.floor(ms / 1000)));
        if (ms >= MAX_VIDEO_SEC * 1000) this.stopVideo();
      }, 250);
    } catch {
      this.cleanupStreams();
      this.errorMessage.set('Could not start the screen recording.');
    } finally {
      this.capturing.set(false);
    }
  }

  stopVideo(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
  }

  private cancelRecording(): void {
    if (!this.recorder) return;
    this.discard = true;
    this.stopVideo();
  }

  private finishVideo(mime: string): void {
    const secs = Math.min(MAX_VIDEO_SEC, Math.max(1, Math.round((Date.now() - this.startedAt) / 1000)));
    const blob = new Blob(this.chunks, { type: mime });
    const keep = !this.discard && blob.size > 0;
    this.cleanupStreams();
    if (keep) this.addCapture('video', blob, mime.includes('mp4') ? 'mp4' : 'webm', secs);
  }

  private cleanupStreams(): void {
    clearInterval(this.timer); this.timer = null;
    this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    this.streams = [];
    this.audioCtx?.close().catch(() => {}); this.audioCtx = null;
    this.recorder = null; this.chunks = [];
    this.recording.set(false);
  }

  /** Opens the captured screenshot / video on a new page. */
  openCapture(c: LocalCapture): void { window.open(c.url, '_blank'); }

  removeCapture(c: LocalCapture): void {
    URL.revokeObjectURL(c.url);
    this.captures.update((l) => l.filter((x) => x.id !== c.id));
  }

  private revokeAll(): void {
    this.captures().forEach((c) => URL.revokeObjectURL(c.url));
    this.captures.set([]);
  }

  fmtSize(b: number): string { return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`; }
  fmtTime(s: number): string { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  ngOnDestroy(): void { this.cancelRecording(); this.cleanupStreams(); this.revokeAll(); }

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

    const form = new FormData();
    form.append('subject', sub);
    form.append('message', desc);
    form.append('customerName', this.auth.getUserName());
    form.append('customerEmail', this.auth.email());
    for (const f of this.pickedFiles.values()) form.append('attachments', f, f.name);
    for (const c of this.captures()) form.append('attachments', c.blob, c.fileName);

    this.portalService
      .raiseTicketToDesk(form)
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
            this.errorMessage.set(res?.message || 'Failed to submit ticket.');
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err?.error?.message || 'Error submitting ticket. Please try again.');
        },
      });
  }
}