import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TextInputComponent } from '../../shared/components/inputs/text-input/text-input';
import { AuthService } from '../../core/services/auth-service';
import { LoginResponse } from '../../core/models/login.model';
import { Utils } from '../../shared/utils/utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TextInputComponent, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  isLoading = signal(false);
  kickedOutMsg = signal('');
  showPassword = signal(false);
  errorMessage = signal('');
  loginForm = new FormGroup({
    username: new FormControl<string>('', Validators.required),
    password: new FormControl<string>('', Validators.required),
  });

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  onSubmit(): void {
    this.errorMessage.set('');
    this.isLoading.set(true);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.isLoading.set(false);
      return;
    }

    const username = this.loginForm.controls.username.value?.trim() || '';
    const password = this.loginForm.controls.password.value?.trim() || '';

    this.authService.login(username, password).subscribe({
      next: (res: LoginResponse) => {
        this.isLoading.set(false);

        if (res.status === true) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set(
            res.msg || 'Invalid username or password. Please try again.'
          );
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.message || 'Something went wrong. Please try again.'
        );
      },
    });
  }
}



