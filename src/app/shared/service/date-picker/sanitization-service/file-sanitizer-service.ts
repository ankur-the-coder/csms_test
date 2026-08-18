import { Injectable } from '@angular/core';
@Injectable({
  providedIn: 'root',
})
export class FileSanitizerService {

  private cache = new Map<string, File>();

  constructor() {}

  async sanitizeFiles(files: File[]): Promise<File[]> {
    const sanitized: File[] = [];

    for (const file of files) {
      const key = this.getFileKey(file);

      if (this.cache.has(key)) {
        sanitized.push(this.cache.get(key)!);
        continue;
      }

      if (file.type === 'application/pdf') {
        const isActuallyPdf = await this.isActualPdf(file);

        if (!isActuallyPdf) {
          alert('Please upload valid PDF');
          continue;
        }

        const { safe, reason } = await this.isPdfSafe(file);

        if (safe) {
          this.cache.set(key, file);
          sanitized.push(file);
        } else {
          console.warn(`PDF rejected: ${reason}`);
          alert('Malicious PDF file detected');
        }
      } else {
        this.cache.set(key, file);
        sanitized.push(file);
      }
    }

    return sanitized;
  }

  private async isActualPdf(file: File): Promise<boolean> {
    try {
      const buffer = await file.slice(0, 5).arrayBuffer();
      const view = new Uint8Array(buffer);
      const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2D];
      return pdfSignature.every((byte, i) => view[i] === byte);
    } catch {
      return false;
    }
  }

  private async isPdfSafe(file: File): Promise<{ safe: boolean; reason?: string }> {
    try {
      const content = await this.readFileAsLatin1(file);
      const riskyIndicators = ['/JavaScript', '/JS', '/Launch', '/OpenAction', '/RichMedia', '/AcroForm'];

      for (const keyword of riskyIndicators) {
        if (content.includes(keyword)) {
          return { safe: false, reason: `Dangerous keyword: "${keyword}"` };
        }
      }

      if (content.includes('/AA')) {
        const combined = riskyIndicators.some(k => content.includes(k));
        if (combined) {
          return { safe: false, reason: '/AA with active content detected' };
        }
      }

      return { safe: true };
    } catch (error) {
      return { safe: false, reason: `Error reading PDF: ${error}` };
    }
  }

  private readFileAsLatin1(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const view = new Uint8Array(reader.result as ArrayBuffer);
        resolve(Array.from(view).map(b => String.fromCharCode(b)).join(''));
      };
      reader.onerror = err => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  private getFileKey(file: File): string {
    return `${file.name}_${file.size}`;
  }
}