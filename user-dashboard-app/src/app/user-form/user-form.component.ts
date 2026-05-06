import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { USER_ROLE_OPTIONS } from '../core/constants/dashboard.constants';
import { CreateUser, UserRole } from '../models/user.model';

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserFormComponent {
  @Output() readonly submitted = new EventEmitter<CreateUser>();
  @Output() readonly closed = new EventEmitter<void>();

  protected readonly roleOptions = USER_ROLE_OPTIONS;

  protected readonly userForm = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['' as UserRole | '', [Validators.required]]
  });

  protected onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const formValue = this.userForm.getRawValue();
    if (!formValue.role) {
      return;
    }

    this.submitted.emit({
      name: formValue.name.trim(),
      email: formValue.email.trim(),
      role: formValue.role
    });

    this.userForm.reset({
      name: '',
      email: '',
      role: ''
    });
  }
}
