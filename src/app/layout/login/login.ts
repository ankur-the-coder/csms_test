import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TextInputComponent } from '../../shared/components/inputs/text-input/text-input';
import { AuthService } from '../../core/services/auth-service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TextInputComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');
  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  onSubmit(): void {
    this.errorMessage.set('');

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);

    const username = (this.loginForm.value.username || '').trim();
    const password = (this.loginForm.value.password || '').trim();

    this.authService.login(username, password).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.status) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set(res.message || 'Login failed.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.message || 'Something went wrong. Please try again.');
      },
    });
  }
}

