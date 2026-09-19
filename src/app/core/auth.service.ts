import { Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
  tenantUuid: string;
}

export interface LoginResponse {
  tokenType: string;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface Tenant {
  tenantUuid: string;
  tenantCode: string;
  tenantName: string;
  status: string;
  createdOn?: string;
  modifiedOn?: string;
}

export interface TenantSearchResponse {
  success: boolean;
  count: number;
  data: Tenant[];
}

export interface RegisterOrganizationRequest {
  organizationName: string;
  organizationType: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  cityId: number | null;
  subDistrictId: number | null;
  districtId: number | null;
  stateId: number | null;
  countryId: number | null;
  postalCodeId: number | null;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  displayName?: string;
  phoneCountryCode: string;
  phoneNumber: string;
  password: string;
}

export interface RegisterOrganizationResponse {
  tokenType?: string;
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  mfaRequired?: boolean;
  mfaToken?: string;
  tenantUuid: string;
  tenantCode: string;
  organizationId: number | null;
  organizationUuid: string | null;
  userId: number;
  userUuid: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly key = "sp3_identity_admin_token";

  private readonly apiBaseUrl = "http://localhost:3000/api/v1/identity-admin";

  readonly token = signal<string | null>(localStorage.getItem(this.key));

  constructor(
    private router: Router,
    private http: HttpClient,
  ) {}

  /**
   * Login
   */
  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiBaseUrl}/auth/login`,
      request,
    );
  }

  /**
   * Search tenants.
   *
   * Search should only be triggered when the user
   * has entered at least 5 characters.
   */
  searchTenants(search: string): Observable<TenantSearchResponse> {
    return this.http.get<TenantSearchResponse>(
      `${this.apiBaseUrl}/public/tenants/search`,
      {
        params: {
          q: search,
        },
      },
    );
  }

  /**
   * Create Organization wizard (2 steps: Organization Details incl.
   * address, then Administrator Detail) — public/unauthenticated, same as
   * login, since this IS how a brand-new org gets its first tenant + user.
   * On success the response carries tokens (auto-login) unless the
   * tenant's security policy requires MFA, in which case it comes back as
   * { mfaRequired: true, ... } instead — same two shapes /auth/login can
   * return.
   */
  registerOrganization(
    request: RegisterOrganizationRequest,
  ): Observable<RegisterOrganizationResponse> {
    return this.http.post<RegisterOrganizationResponse>(
      `${this.apiBaseUrl}/public/register-organization`,
      request,
    );
  }

  /**
   * Store access token
   */
  setToken(token: string) {
    const cleanToken = token.trim();

    localStorage.setItem(this.key, cleanToken);

    this.token.set(cleanToken);
  }

  /**
   * Clear authentication
   */
  clear(queryParams?: Record<string, unknown>) {
    localStorage.removeItem(this.key);

    this.token.set(null);

    this.router.navigate(["/login"], queryParams ? { queryParams } : undefined);
  }

  /**
   * Check authentication
   */
  isAuthenticated() {
    return !!this.token();
  }

  /**
   * Read JWT claims
   */
  claims(): Record<string, unknown> {
    const token = this.token();

    if (!token) {
      return {};
    }

    try {
      const payload = token.split(".")[1];

      return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return {};
    }
  }

  /**
   * Get tenant UUID from JWT
   */
  tenantUuid(): string {
    const c = this.claims();

    return String(c["tenant_uuid"] ?? c["tenantUuid"] ?? c["tid"] ?? "");
  }

  /**
   * SUPERADMIN check, client-side.
   *
   * The access token's `permissions` claim is a flat array of permission
   * codes resolved from the user's active role(s) (see
   * authService.js#resolvePermissions on the identity-admin-service side).
   * The SUPERADMIN role is seeded with exactly one permission,
   * ALL_PERMISSIONS, and nothing else currently grants that code — so its
   * presence is a reliable "is this user a platform superadmin" signal
   * without needing a dedicated /me or /roles round trip. This mirrors the
   * same ALL_PERMISSIONS check identity-admin-service's own
   * authentication.js/authorize() and organization-admin-service's
   * authorization.js use server-side.
   */
  isSuperAdmin(): boolean {
    const c = this.claims();
    const permissions = c["permissions"];

    return Array.isArray(permissions) && permissions.includes("ALL_PERMISSIONS");
  }
}
