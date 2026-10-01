import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth-service';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  public connect(): void {
    if (!this.isBrowser) return;

    const token = this.auth.getToken();
    if (!token) return;

    if (this.socket && this.socket.connected) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    const socketUrl = environment.socketUrl || window.location.origin;

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: (cb) => {
        cb({ token: this.auth.getToken() });
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to ubiClient server');
    });

    this.socket.on('force_logout', (data: { reason?: string }) => {
      console.warn('[Socket] Force logout received:', data?.reason);
      const reason = data?.reason || 'signed_in_elsewhere';
      this.disconnect();
      this.auth.logout(reason);
    });

    this.socket.on('connect_error', (err: any) => {
      if (err?.message === 'unauthorized') {
        console.warn('[Socket] Unauthorized socket connection, disconnecting');
        this.disconnect();
        this.auth.logout('expired');
      }
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  public emit(event: string, ...args: any[]): void {
    if (this.socket) {
      this.socket.emit(event, ...args);
    }
  }
}
