import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "./config";

/**
 * Calls sp3digital-appointment-admin-service's own API (appointments,
 * slot configs) from within identity-admin-ui.
 *
 * No auth headers set here on purpose — same reasoning as OrgApiService:
 * auth.interceptor.ts already attaches `Authorization: Bearer <realToken>`
 * to every outgoing HttpClient request app-wide, and appointment-admin
 * -service verifies tokens minted by identity-admin-service directly, so
 * the logged-in user's own tenant_uuid/permissions claims are exactly
 * what it sees and scopes its data by.
 */
@Injectable({ providedIn: "root" })
export class AppointmentApiService {
  constructor(private http: HttpClient) {}

  get<T>(path: string, query?: Record<string, string | number | undefined>) {
    let params = new HttpParams();
    Object.entries(query ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params = params.set(k, String(v));
    });
    return this.http.get<T>(`${environment.appointmentBaseUrl}${path}`, { params });
  }
}
