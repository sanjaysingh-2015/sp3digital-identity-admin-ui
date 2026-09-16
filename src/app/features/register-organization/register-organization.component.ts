import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { finalize } from "rxjs";

import { AuthService } from "../../core/auth.service";

// Mirrors ORGANIZATION_TYPES in organization-admin-ui's
// organizations.component.ts and organization-admin-service's
// organization.validation.js — keep all three in sync if this list changes.
export const ORGANIZATION_TYPES = [
  "STATE_HEALTH_DEPT",
  "DISTRICT_HEALTH_AUTHORITY",
  "HEALTH_NETWORK",
  "GOVERNMENT",
  "NGO",
  "PRIVATE_CHAIN",
  "OTHER",
];

/** Group-level validator: confirmPassword must match password. */
function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get("password")?.value;
  const confirmPassword = group.get("confirmPassword")?.value;

  return password && confirmPassword && password !== confirmPassword
    ? { passwordMismatch: true }
    : null;
}

/**
 * "Create Organization" — public self-service signup, same backend call
 * (POST /public/register-organization) as before, just split into two
 * screens instead of one long form:
 *   Step 1 — Organization Details (incl. address)
 *   Step 2 — Administrator Detail
 * Both steps' values are combined into a single request on final submit;
 * the API itself hasn't changed shape, only how this page collects it.
 */
@Component({
  selector: "app-register-organization",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./register-organization.component.html",
  styleUrl: "./register-organization.component.scss",
})
export class RegisterOrganizationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  organizationTypes = ORGANIZATION_TYPES;

  step: 1 | 2 = 1;
  submitting = false;
  errorMessage = "";

  // ============================================================
  // STEP 1 — ORGANIZATION DETAILS (WITH ADDRESS)
  // ============================================================

  orgForm = this.fb.group({
    organizationName: ["", [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    organizationType: ["", Validators.required],

    addressLine1: ["", Validators.maxLength(250)],
    addressLine2: ["", Validators.maxLength(250)],
    city: ["", Validators.maxLength(100)],
    subDistrictName: ["", Validators.maxLength(100)],
    districtName: ["", Validators.maxLength(100)],
    stateName: ["", Validators.maxLength(100)],
    country: ["India", Validators.maxLength(100)],
    postalCode: ["", Validators.maxLength(20)],
  });

  // ============================================================
  // STEP 2 — ADMINISTRATOR DETAIL
  // ============================================================

  adminForm = this.fb.group(
    {
      firstName: ["", [Validators.required, Validators.maxLength(100)]],
      lastName: ["", [Validators.required, Validators.maxLength(100)]],
      middleName: ["", Validators.maxLength(100)],
      displayName: ["", Validators.maxLength(250)],

      username: ["", [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      email: ["", [Validators.required, Validators.email, Validators.maxLength(320)]],

      phoneCountryCode: ["+91", [Validators.required, Validators.maxLength(10)]],
      phoneNumber: ["", [Validators.required, Validators.maxLength(30)]],

      password: ["", [Validators.required, Validators.minLength(8), Validators.maxLength(256)]],
      confirmPassword: ["", Validators.required],
    },
    { validators: passwordsMatchValidator },
  );

  // ============================================================
  // STEP NAVIGATION
  // ============================================================

  continueToAdministrator(): void {
    if (this.orgForm.invalid) {
      this.orgForm.markAllAsTouched();
      return;
    }

    this.step = 2;
  }

  backToOrganization(): void {
    this.step = 1;
  }

  // ============================================================
  // SUBMIT (end of step 2)
  // ============================================================

  submit(): void {
    this.errorMessage = "";

    if (this.orgForm.invalid) {
      // Shouldn't normally happen (step 1 is validated before advancing),
      // but guards against e.g. a field being cleared out after going back.
      this.step = 1;
      this.orgForm.markAllAsTouched();
      return;
    }

    if (this.adminForm.invalid) {
      this.adminForm.markAllAsTouched();
      return;
    }

    const org = this.orgForm.getRawValue();
    const admin = this.adminForm.getRawValue();

    const request = {
      organizationName: org.organizationName!.trim(),
      organizationType: org.organizationType!,

      addressLine1: org.addressLine1?.trim() || null,
      addressLine2: org.addressLine2?.trim() || null,
      city: org.city?.trim() || null,
      subDistrictName: org.subDistrictName?.trim() || null,
      districtName: org.districtName?.trim() || null,
      stateName: org.stateName?.trim() || null,
      country: org.country?.trim() || null,
      postalCode: org.postalCode?.trim() || null,

      username: admin.username!.trim(),
      email: admin.email!.trim(),
      firstName: admin.firstName!.trim(),
      lastName: admin.lastName!.trim(),
      middleName: admin.middleName?.trim() || "",
      displayName: (admin.displayName?.trim() || `${admin.firstName} ${admin.lastName}`.trim()),
      phoneCountryCode: admin.phoneCountryCode!.trim(),
      phoneNumber: admin.phoneNumber!.trim(),
      password: admin.password!,
    };

    this.submitting = true;

    this.authService
      .registerOrganization(request)
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (response) => {
          if (response?.accessToken) {
            // Auto-login, same as a normal /auth/login success.
            localStorage.setItem("tenantUuid", response.tenantUuid);
            this.authService.setToken(response.accessToken);
            this.router.navigate(["/dashboard"]);
            return;
          }

          // Tenant's security policy required MFA ({ mfaRequired: true, ... }).
          // This app doesn't have an MFA-challenge screen wired up yet, so
          // send them to sign in normally rather than getting stuck here —
          // the organization itself was still created successfully.
          this.router.navigate(["/login"], {
            queryParams: { organizationCreated: "1" },
          });
        },
        error: (error) => {
          console.error("Organization registration failed:", error);
          this.errorMessage =
            error?.error?.error?.message ??
            error?.error?.message ??
            "Could not create the organization. Please check the details and try again.";
        },
      });
  }
}
