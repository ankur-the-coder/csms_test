import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalService } from '../../../service/modal-service/modal-service';
import { FileSanitizerService } from '../../../service/date-picker/sanitization-service/file-sanitizer-service';


// ─── tiny helper (replaces the shared util) ───────────────────────────────────
function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

@Component({
  selector: 'app-multi-file-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multi-file-input.html',
  styleUrl: './multi-file-input.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiFileInput),
      multi: true,
    },
  ],
})
export class MultiFileInput implements ControlValueAccessor, OnInit, OnDestroy {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  @Input() label = '';
  @Input() isMultiple = true;
  @Input() fileLimit = 3;
  @Input() inputType: 'normal' | 'edit' = 'normal';
  @Input() text: 'small' | 'full' = 'full';
  @Input() required = false;
  @Input() showDeleteButton = true;
  @Input() size = 2; // Maximum file size in MB
  @Output() fileChange = new EventEmitter<any>();

  get maxFileSize(): number {
    return this.size * 1024 * 1024;
  }

  @Input() allowedFileTypes: string[] | null = [
    'image/png',
    'image/jpeg',
    'application/pdf',
    'image/avif',
    'image/webp',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  get allowedExtensionsLabel(): string {
    if (!this.allowedFileTypes || this.allowedFileTypes.length === 0) return 'all';
    
    const extensions = this.allowedFileTypes.map(mime => {
      if (mime === 'image/png') return 'PNG';
      if (mime === 'image/jpeg') return 'JPEG';
      if (mime === 'application/pdf') return 'PDF';
      if (mime === 'image/avif') return 'AVIF';
      if (mime === 'image/webp') return 'WebP';
      if (mime === 'text/csv') return 'CSV';
      if (mime === 'application/vnd.ms-excel') return 'CSV (Excel)';
      if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'Excel (.xlsx)';
      
      const parts = mime.split('/');
      return parts.length > 1 ? parts[1].toUpperCase() : mime;
    });

    const uniqueExts = [...new Set(extensions)];
    if (uniqueExts.length === 0) return 'all';
    if (uniqueExts.length === 1) return uniqueExts[0];
    if (uniqueExts.length === 2) return `${uniqueExts[0]} and ${uniqueExts[1]}`;
    
    const last = uniqueExts.pop();
    return `${uniqueExts.join(', ')} and ${last}`;
  }

  // ── State ───────────────────────────────────────────────────────────────────
  @Input() set preloadedFiles(val: string[] | string | null | undefined) {
    this.setPreloadedUrls(val);
  }
  get preloadedFiles(): string[] {
    return this._preloadedFiles;
  }
  private _preloadedFiles: string[] = [];

  files: File[] = [];
  removedPreloadedFiles: string[] = [];
  isMobileView = false;
  validFileSts = { valid: true, msg: '' };
  limitMsg = '';
  isFileListOpen = false;
  fileThumbs: string[] = [];
  isDragging = false;
  isUploading = false;
  imagePreviewUrl: string | null = null;
  private errorTimer: any = null;

  // ── Viewer state ─────────────────────────────────────────────────────────────
  isViewerOpen = false;
  viewerIndex = 0;
  isViewerLoading = false;
  safeViewerUrl: SafeResourceUrl | null = null;
  viewerItems: {
    file?: File;
    url?: string;
    type: 'image' | 'pdf' | 'text' | 'unknown';
    name: string;
    content?: string;
  }[] = [];

  // ── Form control (ControlValueAccessor) ──────────────────────────────────────
  onChange = (
    _files: File[] | { files: File[]; removedPreloadedFiles: string[] }
  ) => { };
  private onTouched = () => { };
  private touched = false;
  disabled = false;

  readonly id = 'select' + generateRandomString(5);

  constructor(
    public modalService: ModalService,
    private fileSanitizerService: FileSanitizerService,
    private sanitizer: DomSanitizer,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.isMobileView = window.innerWidth <= 768;
    if (this.inputType === 'normal') {
      this.files = [];
      this._preloadedFiles = [];
    }
  }

  ngOnDestroy(): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
    if (this.limitMsgTimer) clearTimeout(this.limitMsgTimer);
    
    const mgmt = document.getElementById(this.id + '-mgmt-overlay');
    if (mgmt) mgmt.remove();
    const viewer = document.getElementById(this.id + '-viewer-overlay');
    if (viewer) viewer.remove();
  }

  writeValue(value: any): void {
    if (!value) {
      if (this.inputType === 'normal') {
        this.files = [];
        this._preloadedFiles = [];
      }
      return;
    }
    if (Array.isArray(value)) {
      const urls: string[] = [];
      const files: File[] = [];
      for (const item of value) {
        if (typeof item === 'string') {
          urls.push(item);
        } else if (item instanceof File) {
          files.push(item);
        } else if (item && typeof item === 'object' && (item.url || item.file_url || item.file_path)) {
          urls.push(item.url || item.file_url || item.file_path);
        }
      }
      if (urls.length > 0) {
        this._preloadedFiles = urls;
      }
      if (files.length > 0) {
        this.files = files;
      }
    } else if (typeof value === 'string') {
      this._preloadedFiles = [value];
    } else if (value && typeof value === 'object') {
      if (Array.isArray(value.preloadedFiles)) {
        this._preloadedFiles = value.preloadedFiles;
      }
      if (Array.isArray(value.files)) {
        this.files = value.files;
      }
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  private setPreloadedUrls(val: any): void {
    if (!val) {
      this._preloadedFiles = [];
    } else if (Array.isArray(val)) {
      this._preloadedFiles = val.filter(u => typeof u === 'string');
    } else if (typeof val === 'string') {
      this._preloadedFiles = [val];
    }
    this.cdr.markForCheck();
  }

  getFileName(url: string): string {
    if (!url) return 'Document';
    try {
      const cleanUrl = url.split('?')[0];
      const parts = cleanUrl.split('/');
      const filename = parts[parts.length - 1];
      return filename ? decodeURIComponent(filename) : 'Document';
    } catch {
      return 'Document';
    }
  }

  // ── Modal controllers ────────────────────────────────────────────────────────
  openFileList(): void {
    this.isFileListOpen = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      const overlay = document.getElementById(this.id + '-mgmt-overlay');
      if (overlay) {
        document.body.appendChild(overlay);
      }
    }, 0);
  }

  closeFileList(): void {
    const overlay = document.getElementById(this.id + '-mgmt-overlay');
    if (overlay) {
      overlay.remove();
    }
    this.isFileListOpen = false;
    this.cdr.detectChanges();
  }

  openViewer(index: number, source: 'new' | 'preloaded'): void {
    this.closeFileList();

    this.viewerItems = [
      ...this.files.map((f) => ({
        file: f,
        type: this.resolveFileType(f.type),
        name: f.name,
      })),
      ...this.preloadedFiles.map((url) => ({
        url,
        type: this.resolveUrlType(url),
        name: this.getFileName(url),
      })),
    ] as typeof this.viewerItems;

    this.viewerIndex = source === 'new' ? index : this.files.length + index;
    this.isViewerOpen = true;
    this.isViewerLoading = true;
    this.imagePreviewUrl = null;
    this.cdr.detectChanges();

    setTimeout(() => {
      const overlay = document.getElementById(this.id + '-viewer-overlay');
      if (overlay) {
        document.body.appendChild(overlay);
      }
      this.loadViewerItem();
    }, 0);
  }

  closeViewer(): void {
    if (this.imagePreviewUrl && this.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }
    this.imagePreviewUrl = null;

    const overlay = document.getElementById(this.id + '-viewer-overlay');
    if (overlay) overlay.remove();
    this.isViewerOpen = false;
    this.safeViewerUrl = null;
    this.viewerItems = [];
    this.modalService.closeModal('mfi-viewer');
  }

  prevViewer(): void {
    if (this.viewerIndex > 0) {
      this.viewerIndex--;
      this.loadViewerItem();
    }
  }

  nextViewer(): void {
    if (this.viewerIndex < this.viewerItems.length - 1) {
      this.viewerIndex++;
      this.loadViewerItem();
    }
  }

  viewFull(): void {
    const item = this.viewerItems[this.viewerIndex];
    if (!item) return;
    const rawUrl = item.file ? URL.createObjectURL(item.file) : item.url!;
    window.open(rawUrl, '_blank');
  }

   downloadFile(item?: { file?: File; url?: string; name: string }): void {
    const target = item || this.viewerItems[this.viewerIndex];
    if (!target) return;

    if (target.file) {
      const url = URL.createObjectURL(target.file);
      const link = document.createElement('a');
      link.href = url;
      link.download = target.name;
      link.click();
      URL.revokeObjectURL(url);
    } else if (target.url) {
      window.open(target.url, '_blank');
    }
  }

  getRemainingLimit(): number {
    return Math.max(0, this.fileLimit - this.getTotalFilesCount());
  }

  get currentViewerItem() {
    return this.viewerItems[this.viewerIndex];
  }

  onViewerImageLoad(): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        this.isViewerLoading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    });
  }

  onViewIconClick(): void {
    const total = this.getTotalFilesCount();
    if (total === 0) return;

    if (total === 1) {
      this.openViewer(0, this.files.length > 0 ? 'new' : 'preloaded');
    } else {
      this.openFileList();
    }
  }

  deleteCurrentViewerItem(): void {
    const item = this.viewerItems[this.viewerIndex];
    if (item.file) {
      const idx = this.files.indexOf(item.file);
      if (idx !== -1) this.removeFile(idx);
    } else if (item.url) {
      const idx = this.preloadedFiles.indexOf(item.url);
      if (idx !== -1) this.removePreloadedFile(idx);
    }
    this.closeViewer();
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.getTotalFilesCount() < this.fileLimit) {
      (event.currentTarget as HTMLElement).classList.add('dragover');
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).classList.remove('dragover');
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const el = event.currentTarget as HTMLElement;
    if (this.getTotalFilesCount() < this.fileLimit) {
      el.classList.remove('dragover');
      if (event.dataTransfer?.files?.length) {
        this.addFiles(event.dataTransfer.files);
      }
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.addFiles(input.files);
      input.value = '';
    }
  }

  onUploadAreaClick(): void {
    if (this.disabled) return;
    if (this.checkFileLimit()) {
      this.showLimitMsg();
      return;
    }
    document.getElementById(this.id)?.click();
  }

  // ── File management ──────────────────────────────────────────────────────────
  async addFiles(files: FileList): Promise<void> {
    if (this.getTotalFilesCount() + files.length > this.fileLimit) {
      this.showLimitMsg();
      return;
    }

    this.isUploading = true;
    this.cdr.detectChanges();

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    const BLOCKED_EXTENSIONS = [
      '.exe', '.bat', '.msi', '.dll', '.sh', '.cmd',
      '.vbs', '.ps1', '.scr', '.com', '.jar', '.pif', '.reg',
      '.zip', '.py', '.rar', '.7z', '.tar', '.gz'
    ];

    for (const file of Array.from(files)) {
      const lowerName = file.name.toLowerCase();
      const isBlocked = BLOCKED_EXTENSIONS.some(ext => lowerName.endsWith(ext));

      if (isBlocked) {
        const ext = lowerName.split('.').pop()?.toUpperCase() || 'EXE';
        invalidFiles.push(
          `${file.name} – .${ext} files are not allowed for security reasons.`
        );
        continue;
      }

      if (this.allowedFileTypes && this.allowedFileTypes.length > 0) {
        if (!this.allowedFileTypes.includes(file.type)) {
          if (file.name.toLowerCase().endsWith('.csv') && this.allowedFileTypes.includes('text/csv')) {
            // allowed
          } else {
            invalidFiles.push(
              `${file.name} – Invalid file type. Only ${this.allowedExtensionsLabel} files are allowed.`
            );
            continue;
          }
        }
        const contentValid = await this.isValidFileContent(file);
        if (!contentValid) {
          invalidFiles.push(
            `${file.name} – File content does not match its type. Renamed files are not allowed.`
          );
          continue;
        }
      }

      if (file.type.startsWith('image/')) {
        try {
          const compressed = await this.compressImage(file);
          validFiles.push(compressed);
        } catch {
          invalidFiles.push(
            `${file.name} – Could not compress image within the 2 MB limit.`
          );
        }
      } else {
        if (file.size > this.maxFileSize) {
          invalidFiles.push(
            `${file.name} – File size exceeds the maximum limit of 2 MB.`
          );
        } else {
          validFiles.push(file);
        }
      }
    }

    if (validFiles.length > 0) {
      try {
        const sanitized =
          await this.fileSanitizerService.sanitizeFiles(validFiles);
        
        setTimeout(() => {
          this.files.push(...sanitized);
          sanitized.forEach((f, idx) => {
            const actualIndex = (this.files.length - sanitized.length) + idx;
            this.generateThumb(f, actualIndex);
          });
          this.clearError();
          this.notifyChange();
          this.isUploading = false;
          this.markAsTouched();
          this.cdr.detectChanges();
        });
      } catch {
        setTimeout(() => {
          this.files.push(...validFiles);
          validFiles.forEach((f, idx) => {
            const actualIndex = (this.files.length - validFiles.length) + idx;
            this.generateThumb(f, actualIndex);
          });
          this.clearError();
          this.notifyChange();
          this.isUploading = false;
          this.markAsTouched();
          this.cdr.detectChanges();
        });
      }
    } else {
      setTimeout(() => {
        if (invalidFiles.length > 0) {
          this.setError(invalidFiles.join('\n'));
        }
        this.isUploading = false;
        this.markAsTouched();
        this.cdr.detectChanges();
      });
    }
  }

  private async isValidFileContent(file: File): Promise<boolean> {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

    if (hex.startsWith('4d5a')) return false;

    const allowed = this.allowedFileTypes || [];
    const noRestriction = !this.allowedFileTypes || this.allowedFileTypes.length === 0;

    if (hex.startsWith('504b')) {
      const isExcelAllowed = allowed.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || allowed.includes('.xlsx');
      if (noRestriction || isExcelAllowed) {
        if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.toLowerCase().endsWith('.xlsx')) {
          return true;
        }
      }
      return false;
    }

    if (hex.startsWith('d0cf')) {
      return noRestriction || allowed.includes('application/vnd.ms-excel') || allowed.includes('.xls');
    }

    if (noRestriction) return true;
    if (hex.startsWith('89504e47')) return allowed.includes('image/png');
    if (hex.startsWith('ffd8ff')) return allowed.includes('image/jpeg');
    if (hex.startsWith('25504446')) return allowed.includes('application/pdf');
    if (hex.startsWith('52494646') && hex.substring(16, 24) === '57454250')
      return allowed.includes('image/webp');
    if (hex.substring(8, 16) === '66747970') return allowed.includes('image/avif');
    if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'))
      return allowed.includes('text/csv') || allowed.includes('application/vnd.ms-excel');

    return false;
  }

  setError(msg: string): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.validFileSts = { valid: false, msg };
    this.errorTimer = setTimeout(() => {
      this.clearError();
    }, 5000);
  }

  clearError(): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.validFileSts = { valid: true, msg: '' };
  }

  removeFile(index: number): void {
    this.files.splice(index, 1);
    this.fileThumbs.splice(index, 1);
    this.notifyChange();
    this.markAsTouched();
    if (this.getTotalFilesCount() === 0) {
      this.closeFileList();
    }
  }

  removePreloadedFile(index: number): void {
    const removedFile = this.preloadedFiles.splice(index, 1)[0];
    if (removedFile) {
      const filePath = this.getFilePath(removedFile) || removedFile;
      this.removedPreloadedFiles.push(filePath);
    }
    this.notifyChange();
    this.markAsTouched();
    if (this.getTotalFilesCount() === 0) {
      this.closeFileList();
    }
  }

  checkFileLimit(): boolean {
    return this.getTotalFilesCount() >= this.fileLimit;
  }

  getTotalFilesCount(): number {
    return this.files.length + this.preloadedFiles.length;
  }

  getReadableFileSize(sizeInBytes: number): string {
    if (sizeInBytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(sizeInBytes) / Math.log(1024));
    return `${(sizeInBytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  getFilePath(url: string): string {
    try {
      if (!url || typeof url !== 'string') throw new Error('Invalid URL');
      const domain = '';
      if (!url.startsWith(domain)) throw new Error('URL domain mismatch');
      return url.substring(domain.length);
    } catch {
      return '';
    }
  }

  markAsTouched(): void {
    if (!this.touched) {
      this.onTouched();
      this.touched = true;
    }
  }

  notifyChange(): void {
    const value = this.inputType === 'edit'
      ? {
        files: this.files,
        removedPreloadedFiles: this.removedPreloadedFiles,
      }
      : (this.files.length > 0 ? this.files : []);

    if (this.onChange) {
      this.onChange(value);
    }
    this.fileChange.emit(value);
  }

  // ── Host listeners ───────────────────────────────────────────────────────────
  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.isMobileView = event.target.innerWidth <= 768;
  }

  // ── Viewer internals ─────────────────────────────────────────────────────────
  private async loadViewerItem(): Promise<void> {
    this.isViewerLoading = true;
    this.safeViewerUrl = null;
    this.imagePreviewUrl = null;
    this.cdr.detectChanges();

    const item = this.viewerItems[this.viewerIndex];
    if (!item) {
      this.isViewerLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.modalService.openModal('mfi-viewer');

    if (item.type === 'text') {
      this.isViewerLoading = false;
      this.cdr.detectChanges();
      return;
    }

    if (item.type === 'pdf') {
      try {
        await this.renderPdfItem(item, 'viewer-pdf-canvas');
      } catch (e) {
        console.warn('PDF.js canvas render failed, falling back to iframe embed:', e);
        const container = document.getElementById('viewer-pdf-canvas');
        if (container) {
          const rawUrl = item.file ? URL.createObjectURL(item.file) : this.normalizePdfUrl(item.url!);
          container.innerHTML = `
            <iframe src="${rawUrl}" class="w-full h-full border-0 rounded-xl bg-white shadow-md"></iframe>
          `;
        }
      } finally {
        this.ngZone.run(() => {
          setTimeout(() => {
            this.isViewerLoading = false;
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          });
        });
      }
      return;
    }

    if (item.type === 'image') {
      const rawUrl = item.file ? URL.createObjectURL(item.file) : item.url!;
      this.ngZone.run(() => {
        this.imagePreviewUrl = rawUrl;
        this.cdr.detectChanges();
      });
      return;
    }

    const rawUrl = item.file ? URL.createObjectURL(item.file) : item.url!;
    this.ngZone.run(() => {
      this.safeViewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
      this.isViewerLoading = false;
      this.cdr.detectChanges();
    });
  }

  private normalizePdfUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    return url.startsWith('/') ? url : `/${url}`;
  }

  // ── PDF.js loader ────────────────────────────────────────────────────────────
  private pdfJsReady: Promise<void> | null = null;

  private loadPdfJs(): Promise<void> {
    if (this.pdfJsReady) return this.pdfJsReady;
    this.pdfJsReady = new Promise((resolve) => {
      if ((window as any).pdfjsLib) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
  import * as pdfjsLib from '/pdfjs/pdf.min.mjs';
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
  window.pdfjsLib = pdfjsLib;
  window.dispatchEvent(new Event('pdfjsReady'));
`;
      window.addEventListener('pdfjsReady', () => resolve(), { once: true });
      document.head.appendChild(script);
    });
    return this.pdfJsReady;
  }

  private async renderPdfItem(
    item: { file?: File; url?: string },
    containerId: string
  ): Promise<void> {
    await this.loadPdfJs();
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js library failed to load');

    let arrayBuffer: ArrayBuffer;
    if (item.file) {
      arrayBuffer = await item.file.arrayBuffer();
    } else if (item.url) {
      const targetUrl = this.normalizePdfUrl(item.url);
      let response = await fetch(targetUrl).catch(() => null);
      if (!response || !response.ok) {
        // Retry with relative or raw URL
        response = await fetch(item.url).catch(() => null);
      }
      if (!response || !response.ok) {
        throw new Error(`Failed to fetch PDF from ${item.url}`);
      }
      arrayBuffer = await response.arrayBuffer();
    } else {
      throw new Error('No file or URL provided for PDF rendering');
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const container = document.getElementById(containerId) as HTMLElement;
    if (!container) throw new Error(`Container #${containerId} not found in DOM`);

    container.innerHTML = '';
    const rawWidth = container.clientWidth || container.parentElement?.clientWidth || 750;
    const containerWidth = Math.max(300, Math.min(rawWidth - 32, 820));

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const baseVp = page.getViewport({ scale: 1 });
      const fitScale = containerWidth / baseVp.width;
      const vp = page.getViewport({ scale: fitScale * 1.5 });

      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.cssText = `width:100%; max-width:${containerWidth}px; height:auto; display:block; margin:0 auto 16px auto; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.15); background-color:#ffffff;`;
      container.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      }
    }
  }

  // ── Image compression ────────────────────────────────────────────────────────
  private compressImage(file: File): Promise<File> {
    if (file.size <= this.maxFileSize) return Promise.resolve(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = async () => {
        URL.revokeObjectURL(objUrl);
        const passes = [
          { quality: 0.8, maxWidth: 2048 },
          { quality: 0.6, maxWidth: 1600 },
          { quality: 0.4, maxWidth: 1200 },
        ];
        for (const pass of passes) {
          const blob = await this.drawCanvas(img, pass.quality, pass.maxWidth);
          if (blob.size <= this.maxFileSize) {
            resolve(
              new File([blob], this.toJpgName(file.name), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
            );
            return;
          }
        }
        reject(new Error('Cannot compress within limit'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Load failed'));
      };
      img.src = objUrl;
    });
  }

  private drawCanvas(
    img: HTMLImageElement,
    quality: number,
    maxWidth: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      let w = img.naturalWidth,
        h = img.naturalHeight;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        quality
      );
    });
  }

  private toJpgName(name: string): string {
    return name.replace(/\.[^.]+$/, '') + '.jpg';
  }

  generateThumb(file: File, index: number): void {
    if (!file.type.startsWith('image/')) {
      this.fileThumbs[index] = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.fileThumbs[index] = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  getFileSizeLabel(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  getFileTypeLabel(mimeType: string): string {
    const map: Record<string, string> = {
      'image/png': 'PNG image',
      'image/jpeg': 'JPEG image',
      'image/gif': 'GIF image',
      'image/webp': 'WebP image',
      'application/pdf': 'PDF document',
      'text/csv': 'CSV file',
      'application/vnd.ms-excel': 'Excel Document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Document',
      'application/msword': 'Word Document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document'
    };
    return map[mimeType] || mimeType;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private limitMsgTimer: any = null;

  private showLimitMsg(): void {
    this.limitMsg = `Only ${this.fileLimit} file${this.fileLimit > 1 ? 's are' : ' is'} allowed.`;
    if (this.limitMsgTimer) clearTimeout(this.limitMsgTimer);
    this.limitMsgTimer = setTimeout(() => (this.limitMsg = ''), 2000);
  }

  private resolveFileType(mime: string): 'image' | 'pdf' | 'text' | 'unknown' {
    if (!mime) return 'unknown';
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('text/') || mime === 'application/csv' || mime.includes('excel') || mime.includes('spreadsheetml')) return 'text';
    return 'unknown';
  }

  private resolveUrlType(url: string): 'image' | 'pdf' | 'text' | 'unknown' {
    if (!url) return 'unknown';
    if (/\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?|$)/i.test(url)) return 'image';
    if (/\.pdf(\?|$)/i.test(url)) return 'pdf';
    if (/\.(csv|txt|xls|xlsx)(\?|$)/i.test(url)) return 'text';
    return 'unknown';
  }

  isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?|$)/i.test(url);
  }
}