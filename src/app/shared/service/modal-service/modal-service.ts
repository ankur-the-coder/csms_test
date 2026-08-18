import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private openModals = new Set<string>();
  private modalState = signal<Set<string>>(new Set());

  openModal(id: string): void {
    this.openModals.add(id);
    this.modalState.set(new Set(this.openModals));
    document.body.style.overflow = 'hidden'; // prevent background scroll
  }

  closeModal(id: string): void {
    this.openModals.delete(id);
    this.modalState.set(new Set(this.openModals));
    if (this.openModals.size === 0) {
      document.body.style.overflow = '';
    }
  }

  isOpen(id: string): boolean {
    return this.modalState().has(id);
  }
}
