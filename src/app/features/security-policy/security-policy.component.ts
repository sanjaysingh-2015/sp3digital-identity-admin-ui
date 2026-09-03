import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { ApiService } from "../../core/api.service";
import { PageComponent } from "../../shared/page.component";
import { NotificationModalComponent } from "../../shared/components/notification-modal/notification-modal";

interface PolicyField {
  key: string;
  label: string;
}

@Component({
  selector: "app-security-policy",
  standalone: true,
  imports: [CommonModule, FormsModule, PageComponent, NotificationModalComponent],
  templateUrl: "./security-policy.component.html",
  styleUrls: ["./security-policy.component.scss"],
})
export class SecurityPolicyComponent implements OnInit {
  loading = false;
  saving = false;

  policy: any = {};

  readonly fields: PolicyField[] = [
    { key: "minPasswordLength", label: "Minimum password length" },
    { key: "passwordHistoryCount", label: "Password history count" },
    { key: "passwordMaxAgeDays", label: "Password max age (days)" },
    { key: "maxFailedAttempts", label: "Max failed attempts" },
    { key: "lockoutDurationMinutes", label: "Lockout duration (minutes)" },
    { key: "accessTokenLifetimeMinutes", label: "Access token lifetime (minutes)" },
    { key: "refreshTokenLifetimeDays", label: "Refresh token lifetime (days)" },
    { key: "maxSessionDurationMinutes", label: "Max session duration (minutes)" },
    { key: "maxConcurrentSessions", label: "Max concurrent sessions" },
  ];

  @ViewChild("notificationModal")
  notificationModal!: NotificationModalComponent;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;

    this.api.get<any>("/security-policy").subscribe({
      next: (response) => {
        this.policy = response?.data || response || {};
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error("Failed to load security policy:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Failed to load security policy",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  save(): void {
    this.saving = true;

    this.api.post<any>("/security-policy", this.policy).subscribe({
      next: () => {
        this.saving = false;
        this.notificationModal.open({
          type: "SUCCESS",
          title: "Security Policy Updated",
          message: "Security policy updated successfully.",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
      error: (error) => {
        this.saving = false;
        console.error("Failed to update security policy:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Security Policy Update Failed",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }
}
