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
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
  imports: [],
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

  @Input() required = false; // Optional required flag


  // ── Config ──────────────────────────────────────────────────────────────────
  @Input() size = 2; // Maximum file size in MB
  @Output() fileChange = new EventEmitter<any>();
  // Add this property to State section
  imagePreviewUrl: string | null = null;
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
  files: File[] = [];
  preloadedFiles: string[] = [];
  removedPreloadedFiles: string[] = [];
  isMobileView = false;
  validFileSts = { valid: true, msg: '' };
  limitMsg = '';
  isFileListOpen = false;
  fileThumbs: string[] = []; // Array to store thumbnails for uploaded files
  isDragging = false;
  isUploading = false;
  private errorTimer: any = null; // for auto-hiding error

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

  // ── Form control ─────────────────────────────────────────────────────────────
  onChange = (
    _files: File[] | { files: File[]; removedPreloadedFiles: string[] }
  ) => { };
  private onTouched = () => { };
  private touched = false;
  disabled = false;

  readonly id = 'select' + generateRandomString(5);

  constructor(
    private sanitizer: DomSanitizer,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.isMobileView = window.innerWidth <= 768;
    if (this.inputType === 'normal') {
      this.files = [];
      this.preloadedFiles = [];
    }
  }

  ngOnDestroy(): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
    if (this.limitMsgTimer) clearTimeout(this.limitMsgTimer);

    // Clean up any dynamically appended overlay elements
    const mgmt = document.getElementById(this.id + '-mgmt-overlay');
    if (mgmt) mgmt.remove();
    const viewer = document.getElementById(this.id + '-viewer-overlay');
    if (viewer) viewer.remove();
  }

  // ── Modal controllers ────────────────────────────────────────────────────────
  openFileList(): void {
    this.isFileListOpen = true;
    setTimeout(() => {
      const overlay = document.getElementById(this.id + '-mgmt-overlay');
      if (overlay) {
        document.body.appendChild(overlay);
      }
    }, 10);
  }

  closeFileList(): void {
    const overlay = document.getElementById(this.id + '-mgmt-overlay');
    if (overlay) {
      overlay.remove();
    }
    this.isFileListOpen = false;
  }

  openViewer(index: number, source: 'new' | 'preloaded'): void {
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
    this.isViewerLoading = true;   // ← set loader BEFORE modal opens
    this.imagePreviewUrl = null;
    this.cdr.detectChanges();      // ← force render the modal into DOM now

    setTimeout(() => {
      const overlay = document.getElementById(this.id + '-viewer-overlay');
      if (overlay) {
        document.body.appendChild(overlay);
      }
      this.loadViewerItem();       // ← now DOM exists, safe to load
    }, 0);
  }

  closeViewer(): void {
    // Revoke blob URL to free memory
    if (this.imagePreviewUrl && this.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }
    this.imagePreviewUrl = null;

    const overlay = document.getElementById(this.id + '-viewer-overlay');
    if (overlay) overlay.remove();
    this.isViewerOpen = false;
    this.safeViewerUrl = null;
    this.viewerItems = [];
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

    // Blocked executable/dangerous file extensions (always rejected)
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
        // Magic bytes check — rename se bypass nahi hoga
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
      setTimeout(() => {
        this.files.push(...validFiles);
        validFiles.forEach((f: File, idx: number) => {
          const actualIndex = (this.files.length - validFiles.length) + idx;
          this.generateThumb(f, actualIndex);
        });
        this.clearError();
        this.notifyChange();
        this.isUploading = false;
        this.markAsTouched();
        this.cdr.detectChanges();
      });
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

    // EXE/DLL — block always
    if (hex.startsWith('4d5a')) return false;

    const allowed = this.allowedFileTypes || [];
    const noRestriction = !this.allowedFileTypes || this.allowedFileTypes.length === 0;

    // ZIP files (this includes .xlsx and .docx since they are zipped XMLs)
    // We check for '504b' because ZIPs can be 504b0304, 504b0506, etc.
    if (hex.startsWith('504b')) {
      // Allow if Excel is permitted or no restriction is applied
      const isExcelAllowed = allowed.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || allowed.includes('.xlsx');
      if (noRestriction || isExcelAllowed) {
        if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.toLowerCase().endsWith('.xlsx')) {
          return true;
        }
      }
      // Otherwise block (it's a plain .zip or unauthorized archive)
      return false;
    }

    // Older Excel .xls
    if (hex.startsWith('d0cf')) {
      return noRestriction || allowed.includes('application/vnd.ms-excel') || allowed.includes('.xls');
    }

    // If no allowedFileTypes restriction — pass through
    if (noRestriction) return true;

    // PNG
    if (hex.startsWith('89504e47')) return allowed.includes('image/png');

    // JPEG
    if (hex.startsWith('ffd8ff')) return allowed.includes('image/jpeg');

    // PDF
    if (hex.startsWith('25504446')) return allowed.includes('application/pdf');

    // WEBP
    if (hex.startsWith('52494646') && hex.substring(16, 24) === '57454250')
      return allowed.includes('image/webp');

    // AVIF
    if (hex.substring(8, 16) === '66747970') return allowed.includes('image/avif');

    // CSV / plain text — no magic bytes, allow if type matches
    if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'))
      return allowed.includes('text/csv') || allowed.includes('application/vnd.ms-excel');

    // Unknown magic bytes — block
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

  getFileName(url: string): string {
    try {
      if (!url || typeof url !== 'string') throw new Error('Invalid URL');
      const last = url.lastIndexOf('/');
      if (last === -1) throw new Error('No filename in URL');
      return url.substring(last + 1);
    } catch {
      return 'file';
    }
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

  // ── CVA ──────────────────────────────────────────────────────────────────────
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  markAsTouched(): void {
    if (!this.touched) {
      this.onTouched();
      this.touched = true;
    }
  }

  writeValue(files: File[] | string[]): void {
    if (this.inputType === 'normal') {
      this.files = [];
      this.preloadedFiles = [];
    } else if (files && files.length && Array.isArray(files)) {
      if (typeof files[0] === 'string') {
        this.preloadedFiles = [...(files as string[])];
        this.files = [];
      } else {
        this.files = files as File[];
        this.preloadedFiles = [];
      }
    } else {
      this.files = [];
      this.preloadedFiles = [];
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
    this.cdr.detectChanges();  // show spinner immediately

    const item = this.viewerItems[this.viewerIndex];
    if (!item) {
      this.isViewerLoading = false;
      this.cdr.detectChanges();
      return;
    }

    if (item.type === 'text') {
      this.isViewerLoading = false;
      this.cdr.detectChanges();
      return;
    }

    if (item.type === 'pdf') {
      try {
        if (item.file) {
          await this.renderPdfFromFile(item.file, 'viewer-pdf-canvas');
          return;
        }
        if (item.url) {
          await this.loadPdfJs();
          const pdfjsLib = (window as any).pdfjsLib;
          if (!pdfjsLib) throw new Error('pdfjsLib not loaded');
          const pdf = await pdfjsLib.getDocument({ url: item.url, withCredentials: false }).promise;
          const container = document.getElementById('viewer-pdf-canvas') as HTMLElement;
          if (!container) throw new Error('PDF viewer container not found');
          container.innerHTML = '';
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const vp = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = vp.width;
            canvas.height = vp.height;
            canvas.style.cssText = 'width:100%;display:block;margin-bottom:8px';
            container.appendChild(canvas);
            await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
          }
          return;
        }
      } catch (e) {
        console.error('PDF render failed', e);
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
      // Generate the URL and let Angular bind it — (load) event will hide spinner
      const rawUrl = item.file ? URL.createObjectURL(item.file) : item.url!;
      this.ngZone.run(() => {
        this.imagePreviewUrl = rawUrl;
        this.cdr.detectChanges();  // ← bind src NOW so <img> starts loading
      });
      return;  // spinner hidden by onViewerImageLoad()
    }

    // unknown
    const rawUrl = item.file ? URL.createObjectURL(item.file) : item.url!;
    this.ngZone.run(() => {
      this.safeViewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
      this.isViewerLoading = false;
      this.cdr.detectChanges();
    });
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

  private async renderPdfFromFile(
    file: File,
    containerId: string
  ): Promise<void> {
    await this.loadPdfJs();
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) return;
    try {
      const ab = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      const container = document.getElementById(containerId) as HTMLElement;
      if (!container) return;
      container.innerHTML = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.cssText = 'width:100%;display:block;margin-bottom:8px';
        container.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
      }
    } catch (e) {
      console.error('PDF render failed', e);
    } finally {
      this.ngZone.run(() => {
        setTimeout(() => {
          this.isViewerLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      });
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
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('text/') || mime === 'application/csv' || mime.includes('excel') || mime.includes('spreadsheetml')) return 'text';
    return 'unknown';
  }

  private resolveUrlType(url: string): 'image' | 'pdf' | 'text' | 'unknown' {
    if (/\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?|$)/i.test(url)) return 'image';
    if (/\.pdf(\?|$)/i.test(url)) return 'pdf';
    if (/\.(csv|txt|xls|xlsx)(\?|$)/i.test(url)) return 'text';
    return 'unknown';
  }

  isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?|$)/i.test(url);
  }
}