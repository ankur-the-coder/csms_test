import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TextInputComponent } from '../../shared/components/inputs/text-input/text-input';
import { AuthService } from '../../core/services/auth-service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TextInputComponent, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  isLoading = signal(false)
  errorMsg = signal('')

  kickedOutMsg = signal('')
  showPassword = signal(false);
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
    this.errorMsg.set('');
    this.isLoading.set(true);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.isLoading.set(false);
      return;
    }


    const username = (this.loginForm.value.username || '').trim();
    const password = (this.loginForm.value.password || '').trim();

    this.authService.login(username, password).subscribe({
      next: (res) => {
        if (res.status == true) {
          this.router.navigate(['/dashboard']);
          this.isLoading.set(false);
        } else {
          this.isLoading.set(false);
          this.errorMessage.set(res.message || 'Something went wrong. Please try again.');
        }

      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.message || 'Something went wrong. Please try again.');
      },
    });
  }

}


