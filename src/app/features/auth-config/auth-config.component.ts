import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { ApiService } from "../../core/api.service";
import { AuthService } from "../../core/auth.service";
import { PageComponent } from "../../shared/page.component";
import { NotificationModalComponent } from "../../shared/components/notification-modal/notification-modal";

export interface Tenant {
  tenantUuid: string;
  tenantCode: string;
  tenantName: string;
  status?: string;
}

@Component({
  selector: "app-auth-config",
  standalone: true,
  imports: [CommonModule, FormsModule, PageComponent, NotificationModalComponent],
  templateUrl: "./auth-config.component.html",
  styleUrls: ["./auth-config.component.scss"],
})
export class AuthConfigComponent implements OnInit {
  tenants: Tenant[] = [];
  loadingTenants = false;
  tenantUuid = "";

  loading = false;
  saving = false;

  readonly authenticationModes: string[] = ["PASSWORD", "OIDC", "SSO"];

  config: any = {
    authenticationMode: "PASSWORD",
    defaultIdentityProviderId: "",
    sessionPolicy: "",
    loginChannel: "",
    mfaEnabled: false,
  };

  @ViewChild("notificationModal")
  notificationModal!: NotificationModalComponent;

  constructor(
    private api: ApiService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadTenants();

    // Default to the currently authenticated tenant, if one is present in
    // the JWT, and load its configuration straight away.
    const currentTenant = this.auth.tenantUuid();
    if (currentTenant) {
      this.tenantUuid = currentTenant;
      this.load();
    }
  }

  loadTenants(): void {
    this.loadingTenants = true;

    this.api.get<any>("/tenants/list").subscribe({
      next: (response) => {
        this.tenants = response?.data || response?.items || [];
        this.loadingTenants = false;
      },
      error: (error) => {
        this.loadingTenants = false;
        console.error("Failed to load tenants:", error);
      },
    });
  }

  onTenantChange(): void {
    if (this.tenantUuid) {
      this.load();
    }
  }

  load(): void {
    if (!this.tenantUuid) {
      return;
    }

    this.loading = true;

    this.api.get<any>(`/auth-configs/${this.tenantUuid}`).subscribe({
      next: (response) => {
        this.config = {
          authenticationMode: "PASSWORD",
          defaultIdentityProviderId: "",
          sessionPolicy: "",
          loginChannel: "",
          mfaEnabled: false,
          ...(response?.data || response || {}),
        };
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error("Failed to load authentication configuration:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Failed to load configuration",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  save(): void {
    if (!this.tenantUuid) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Authentication configuration",
        message: "Select a tenant first.",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.saving = true;

    this.api.put<any>(`/auth-configs/${this.tenantUuid}`, this.config).subscribe({
      next: () => {
        this.saving = false;
        this.notificationModal.open({
          type: "SUCCESS",
          title: "Configuration Updated",
          message: "Authentication configuration updated successfully.",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
      error: (error) => {
        this.saving = false;
        console.error("Failed to update authentication configuration:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Configuration Update Failed",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }
}
