import { Component, OnInit, inject } from "@angular/core";
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import {
  debounceTime,
  distinctUntilChanged,
  filter,
  switchMap,
  catchError,
  finalize,
  of,
} from "rxjs";

import { AuthService, Tenant } from "../../core/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  loading = false;
  tenantLoading = false;

  tenants: Tenant[] = [];
  showTenantList = false;
  errorMessage = "";

  loginForm = this.fb.group({
    usernameOrEmail: ["", Validators.required],

    password: ["", Validators.required],

    tenant: ["", Validators.required],

    tenantUuid: ["", Validators.required],
  });

  ngOnInit(): void {
    this.loginForm.controls.tenant.valueChanges
      .pipe(
        debounceTime(400),

        distinctUntilChanged(),

        filter((value) => (value ?? "").trim().length >= 5),

        switchMap((value) => {
          const searchValue = (value ?? "").trim();

          this.tenantLoading = true;

          return this.authService.searchTenants(searchValue).pipe(
            catchError((error) => {
              console.error("Tenant search failed:", error);

              this.tenants = [];
              this.showTenantList = false;

              return of({
                success: false,
                count: 0,
                data: [],
              });
            }),

            finalize(() => {
              this.tenantLoading = false;
            }),
          );
        }),
      )

      .subscribe({
        next: (response) => {
          this.tenants = response.data || [];

          this.showTenantList = this.tenants.length > 0;
        },
      });
  }

  selectTenant(tenant: Tenant): void {
    this.loginForm.patchValue({
      tenant: `${tenant.tenantName} (${tenant.tenantCode})`,
      tenantUuid: tenant.tenantUuid,
    });
    this.showTenantList = false;
  }

  login(): void {
    this.errorMessage = "";

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();

      return;
    }

    const { usernameOrEmail, password, tenantUuid } =
      this.loginForm.getRawValue();

    const request = {
      usernameOrEmail: usernameOrEmail!,
      password: password!,
      tenantUuid: tenantUuid!,
    };

    this.loading = true;
    this.authService
      .login(request)
      .pipe(
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (response) => {
          console.log("Login successful");
          localStorage.setItem("tenantUuid", tenantUuid!)
          this.authService.setToken(response.accessToken);

          // Add dashboard navigation here
          this.router.navigate(['/dashboard']);
        },

        error: (error) => {
          console.error("Login failed:", error);

          this.errorMessage =
            error?.error?.error?.message ??
            "Invalid username, password or tenant.";
        },
      });
  }
}
