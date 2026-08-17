import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { UiService } from '../../core/ui.service';
import { PageComponent } from '../../shared/page.component';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    FormsModule,
    PageComponent
  ],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class RolesComponent implements OnInit {

  rows: any[] = [];

  formOpen = false;

  form = {
    roleName: '',
    roleCode: '',
    description: ''
  };

  constructor(
    private api: ApiService,
    private ui: UiService
  ) {
    this.load();
  }

  ngOnInit(): void {
    this.load();
  }
  
  load(): void {
    this.api
      .get<any>('/authorization/roles', {
        page: 1,
        limit: 100
      })
      .subscribe({
        next: (response) => {
          this.rows =
            response?.data?.items ||
            response?.items ||
            response?.data ||
            [];
        },
        error: (error) => {
          console.error('Failed to load roles', error);
          this.ui.show('Failed to load roles');
        }
      });
  }

  openCreate(): void {
    this.formOpen = true;
  }

  closeCreate(): void {
    this.formOpen = false;

    this.form = {
      roleName: '',
      roleCode: '',
      description: ''
    };
  }

  create(): void {

    if (!this.form.roleName.trim()) {
      this.ui.show('Role name is required');
      return;
    }

    if (!this.form.roleCode.trim()) {
      this.ui.show('Role code is required');
      return;
    }

    this.api
      .post('/authorization/roles', this.form)
      .subscribe({
        next: () => {
          this.closeCreate();
          this.ui.show('Role created');
          this.load();
        },
        error: (error) => {
          console.error('Failed to create role', error);
          this.ui.show(
            error?.error?.message || 'Failed to create role'
          );
        }
      });
  }
}