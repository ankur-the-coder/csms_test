import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TextInputComponent } from '../../shared/components/inputs/text-input/text-input';
import { AuthService } from '../../core/services/auth-service';
import { LoginResponse } from '../../core/models/login.model';
import { Utils } from '../../shared/utils/utils';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TextInputComponent, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly toastr = inject(ToastrService);


  isLoading = signal(false);
  kickedOutMsg = signal('');
  showPassword = signal(false);
  errorMessage = signal('');
  loginForm = new FormGroup({
    // username: new FormControl<string>('', [
    //   Validators.required,
    //   Validators.minLength(5)
    // ]),
    username: new FormControl<string>('', [
      Validators.required
    ]),
    password: new FormControl<string>('', Validators.required),
  });

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }
  get username() {
    return this.loginForm.controls.username;
  }

  get password() {
    return this.loginForm.controls.password;
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

    const username = this.loginForm.controls.username.value?.trim() || '';
    const password = this.loginForm.controls.password.value?.trim() || '';

    this.authService.login(username, password).subscribe({
      next: (res: LoginResponse) => {
        this.isLoading.set(false);

        if (res.status === true) {

          this.toastr.success('Logged in successfully.', 'Success');
          this.router.navigate(['/dashboard']);
        } else {
          this.toastr.error(res.msg || 'Failed to login.', 'Error');
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

