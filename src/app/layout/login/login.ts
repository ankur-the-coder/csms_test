import { Component, inject, OnInit, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';
import { SocketService } from '../../core/services/socket.service';
import { LoginResponse, SessionDevice } from '../../core/models/login.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './login.html',
  styleUrl: './login.css',
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
          this.errorMessage.set(res.msg || 'Too many login attempts. Please try again later.');
          this.toastr.warning(this.errorMessage(), 'Rate Limited');
        } else {
          this.toastr.error(res.msg || 'Failed to login.', 'Error');
          this.errorMessage.set(res.msg || 'Invalid username or password. Please try again.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errBody = err?.error;
        if (err.status === 409 || errBody?.code === 'SESSION_LIMIT') {
          this.conflictDevices.set(errBody?.devices || []);
          this.showConflictModal.set(true);
        } else if (err.status === 429 || errBody?.code === 'RATE_LIMITED') {
          const msg = errBody?.msg || 'Too many login attempts. Please try again later.';
          this.errorMessage.set(msg);
          this.toastr.warning(msg, 'Rate Limited');
        } else {
          this.errorMessage.set(
            errBody?.msg || errBody?.message || 'Something went wrong. Please try again.'
          );
        }
      },
    });
  }

  confirmLogoutOthers(): void {
    this.onSubmit(true);
  }

  cancelConflictModal(): void {
    this.showConflictModal.set(false);
  }
}