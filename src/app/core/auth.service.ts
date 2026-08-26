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
}
