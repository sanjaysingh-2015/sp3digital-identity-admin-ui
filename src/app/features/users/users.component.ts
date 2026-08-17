import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { UiService } from '../../core/ui.service';
import { PageComponent } from '../../shared/page.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageComponent
  ],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {

  rows: any[] = [];

  search = '';
  status = '';

  formOpen = false;
  selected: any = null;

  loading = false;
  creating = false;

  form = {
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    userType: 'USER'
  };

  constructor(
    private api: ApiService,
    private ui: UiService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;

    this.api.get<any>('/users', {
      page: 1,
      limit: 50,
      search: this.search,
      status: this.status
    }).subscribe({
      next: (response) => {
        this.rows =
          response?.data?.items ||
          response?.items ||
          response?.data ||
          response?.rows ||
          [];

        this.loading = false;
      },
      error: (error) => {
        this.loading = false;

        console.error('Failed to load users:', error);

        this.ui.show(
          error?.error?.message || 'Failed to load users'
        );
      }
    });
  }

  openCreate(): void {
    this.resetForm();
    this.formOpen = true;
  }

  closeCreate(): void {
    this.formOpen = false;
  }

  create(): void {

    if (
      !this.form.username ||
      !this.form.email ||
      !this.form.firstName ||
      !this.form.lastName
    ) {
      this.ui.show('Please fill all required fields');
      return;
    }

    this.creating = true;

    this.api.post<any>('/users', this.form).subscribe({
      next: () => {

        this.creating = false;
        this.formOpen = false;

        this.ui.show('User created successfully');

        this.resetForm();
        this.load();
      },

      error: (error) => {

        this.creating = false;

        console.error('Failed to create user:', error);

        this.ui.show(
          error?.error?.message || 'Failed to create user'
        );
      }
    });
  }

  select(user: any): void {

    const userId =
      user?.user_id ||
      user?.userId;

    if (!userId) {
      this.ui.show('Invalid user ID');
      return;
    }

    this.loading = true;

    this.api.get<any>(`/users/${userId}`).subscribe({
      next: (response) => {

        this.selected =
          response?.data ||
          response;

        this.loading = false;
      },

      error: (error) => {

        this.loading = false;

        console.error('Failed to load user:', error);

        this.ui.show(
          error?.error?.message || 'Failed to load user details'
        );
      }
    });
  }

  closeDetails(): void {
    this.selected = null;
  }

  getUserName(user: any): string {
    const firstName =
      user?.first_name ||
      user?.firstName ||
      '';

    const lastName =
      user?.last_name ||
      user?.lastName ||
      '';

    const fullName =
      `${firstName} ${lastName}`.trim();

    return fullName || user?.username || '—';
  }

  getUserType(user: any): string {
    return (
      user?.user_type ||
      user?.userType ||
      'USER'
    );
  }

  getCreatedDate(user: any): string {
    return (
      user?.created_on ||
      user?.createdOn ||
      user?.createdAt ||
      '—'
    );
  }

  resetForm(): void {
    this.form = {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      userType: 'USER'
    };
  }
}