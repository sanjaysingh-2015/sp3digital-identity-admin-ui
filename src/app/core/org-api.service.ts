import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "./config";

/**
 * Calls organization-admin-service's own API (organizations, facilities,
 * etc.) from within identity-admin-ui.
 *
 * Unlike GeoService (which deliberately forces the internal-service token +
 * a placeholder tenant for the *unauthenticated* self-registration wizard),
 * this is for authenticated admin screens: it sends no auth headers of its
 * own on purpose. auth.interceptor.ts already attaches
 * `Authorization: Bearer <realToken>` to every outgoing HttpClient request
 * app-wide, and organization-admin-service's authentication.js verifies
 * tokens minted by identity-admin-service directly (same JWKS/shared
 * secret) — so the logged-in user's own tenant_uuid/permissions claims are
 * exactly what organization-admin-service sees and scopes its data by.
 */
@Injectable({ providedIn: "root" })
export class OrgApiService {
  constructor(private http: HttpClient) {}

  get<T>(path: string, query?: Record<string, string | number | undefined>) {
    let params = new HttpParams();
    Object.entries(query ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params = params.set(k, String(v));
    });
    return this.http.get<T>(`${environment.orgBaseUrl}${path}`, { params });
  }
}
