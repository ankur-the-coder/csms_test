import { Component, inject, OnInit, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';
import { SocketService } from '../../core/services/socket.service';
import { LoginResponse, SessionDevice } from '../../core/models/login.model';
import { ToastrService } from 'ngx-toastr';

/**
 * Friendly, user-safe reasons for each failure the backend can report.
 * Raw server text / status codes / stack traces are never shown on the login panel.
 */
const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Incorrect username or password. Please check your details and try again.',
  ACCOUNT_DISABLED: 'Your account is currently disabled. Please contact your administrator.',
  NO_ORGANIZATION: 'Your account is not linked to any organization yet. Please contact support.',
  VALIDATION_FAILED: 'Please enter both your username and password.',
  SERVER_ERROR: 'We could not sign you in right now because of a temporary problem. Please try again in a few minutes.',
};

/** Codes whose server message is personalised (contains the person's first name) and is shown as-is. */
const SERVER_MESSAGE_CODES = ['USE_AGENT_CREDENTIALS', 'HR_RIGHTS_REQUIRED'];

const GENERIC_LOGIN_ERROR = 'We could not sign you in. Please check your details and try again.';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './login.html',
  styleUrl: './login.css',
  host: {
    class:
      `relative block h-screen w-full overflow-hidden antialiased [font-family:'SF_Pro_Display',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]`,
  },
})
export class Login implements OnInit {
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly socketService = inject(SocketService);

  isLoading = signal(false);
  kickedOutMsg = signal('');
  showPassword = signal(false);
  errorMessage = signal('');

  // 409 Conflict modal state
  showConflictModal = signal(false);
  conflictDevices = signal<SessionDevice[]>([]);

  loginForm = new FormGroup({
    username: new FormControl<string>('', [Validators.required]),
    password: new FormControl<string>('', Validators.required),
  });

  get username() {
    return this.loginForm.controls.username;
  }

  get password() {
    return this.loginForm.controls.password;
  }

  ngOnInit(): void {
    // Check if user was kicked out or session expired
    if (typeof window !== 'undefined') {
      const reason = sessionStorage.getItem('logout_reason');
      if (reason) {
        sessionStorage.removeItem('logout_reason');
        if (reason === 'signed_in_elsewhere') {
          this.kickedOutMsg.set('You have signed in on another device and were logged out here.');
        } else if (reason === 'logged_out_remotely') {
          this.kickedOutMsg.set('Your session was remotely logged out by another login.');
        } else if (reason === 'expired') {
          this.kickedOutMsg.set('Your session has expired. Please sign in again.');
        }
      }
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  onSubmit(logoutOthers: boolean = false): void {
    if (this.isLoading()) {
      return;
    }
    this.errorMessage.set('');

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);

    const username = this.loginForm.controls.username.value?.trim() || '';
    const password = this.loginForm.controls.password.value?.trim() || '';

    this.authService.login(username, password, logoutOthers).subscribe({
      next: (res: LoginResponse) => {
        this.isLoading.set(false);

        if (res.status === true) {
          this.showConflictModal.set(false);
          // Connect real-time socket
          this.socketService.connect();
          // Client (UserMaster) logins go to the client portal, agents to the existing app.
          this.router.navigate([res.data?.userType === 'client' ? '/client-portal' : '/dashboard']);
        } else if (res.code === 'SESSION_LIMIT') {
          this.conflictDevices.set(res.devices || []);
          this.showConflictModal.set(true);
        } else if (res.code === 'RATE_LIMITED') {
          const msg = this.rateLimitMessage(res.retryAfterSeconds);
          this.errorMessage.set(msg);
          this.toastr.warning(msg, 'Too Many Attempts');
        } else {
          this.errorMessage.set(this.resolveErrorMessage(res.code, res.msg));
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errBody = err?.error;
        if (err?.status === 409 || errBody?.code === 'SESSION_LIMIT') {
          this.conflictDevices.set(errBody?.devices || []);
          this.showConflictModal.set(true);
        } else if (err?.status === 429 || errBody?.code === 'RATE_LIMITED') {
          const msg = this.rateLimitMessage(errBody?.retryAfterSeconds);
          this.errorMessage.set(msg);
          this.toastr.warning(msg, 'Too Many Attempts');
        } else {
          this.errorMessage.set(this.resolveHttpErrorMessage(err?.status, errBody?.code, errBody?.msg));
        }
      },
    });
  }

  /** Maps a backend reason code to a safe, readable message. */
  private resolveErrorMessage(code?: string, msg?: string): string {
    if (code && msg && SERVER_MESSAGE_CODES.includes(code)) {
      return msg;
    }
    return (code && LOGIN_ERROR_MESSAGES[code]) || GENERIC_LOGIN_ERROR;
  }

  /** Maps an HTTP failure (network down, 5xx, etc.) to a safe, readable message. */
  private resolveHttpErrorMessage(status?: number, code?: string, msg?: string): string {
    if (code && msg && SERVER_MESSAGE_CODES.includes(code)) {
      return msg;
    }
    if (code && LOGIN_ERROR_MESSAGES[code]) {
      return LOGIN_ERROR_MESSAGES[code];
    }
    if (!status) {
      return 'Unable to reach the server. Please check your internet connection and try again.';
    }
    if (status === 422 || status === 400) {
      return LOGIN_ERROR_MESSAGES['VALIDATION_FAILED'];
    }
    if (status === 401 || status === 403) {
      return LOGIN_ERROR_MESSAGES['INVALID_CREDENTIALS'];
    }
    if (status === 404 || status === 502 || status === 503 || status === 504) {
      return 'The sign-in service is currently unavailable. Please try again in a few minutes.';
    }
    if (status >= 500) {
      return LOGIN_ERROR_MESSAGES['SERVER_ERROR'];
    }
    return GENERIC_LOGIN_ERROR;
  }

  private rateLimitMessage(retryAfterSeconds?: number): string {
    const secs = Number(retryAfterSeconds);
    if (!secs || secs <= 0) {
      return 'Too many unsuccessful attempts. Please wait a few minutes before trying again.';
    }
    const mins = Math.ceil(secs / 60);
    return `Too many unsuccessful attempts. Please try again in about ${mins} minute${mins === 1 ? '' : 's'}.`;
  }

  confirmLogoutOthers(): void {
    this.onSubmit(true);
  }

  cancelConflictModal(): void {
    this.showConflictModal.set(false);
  }
}