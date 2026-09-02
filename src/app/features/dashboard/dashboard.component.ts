import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

import { ApiService } from "../../core/api.service";
import { PageComponent } from "../../shared/page.component";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [RouterLink, PageComponent],
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"],
})
export class DashboardComponent {
  stats = [
    {
      label: "Tenants",
      value: "—",
      hint: "Live from API",
      icon: "▣",
    },
    {
      label: "Users",
      value: "—",
      hint: "Live from API",
      icon: "♙",
    },
    {
      label: "Roles",
      value: "—",
      hint: "Live from API",
      icon: "🔐",
    },
    {
      label: "Permissions",
      value: "—",
      hint: "Live from API",
      icon: "🛡",
    },
    {
      label: "Identity Providers",
      value: "—",
      hint: "Live from API",
      icon: "📋",
    },
  ];

  quick = [
    {
      title: "Tenants",
      text: "Tenant management",
      link: "/tenants",
      icon: "▣",
    },
    {
      title: "Users",
      text: "Accounts and role assignments",
      link: "/users",
      icon: "♙",
    },
    {
      title: "Identity Providers",
      text: "OIDC / SAML provider administration",
      link: "/identity-providers",
      icon: "🔐",
    },
    {
      title: "Security Policy",
      text: "Password, token and MFA controls",
      link: "/security-policy",
      icon: "🛡",
    },
    {
      title: "Audit Logs",
      text: "Administrative activity trail",
      link: "/audit-logs",
      icon: "📋",
    },
  ];

  claims: any = {};
  scopeText = "—";

  constructor(private api: ApiService) {
    this.api.get<any>("/tenants", { page: 1, limit: 1 }).subscribe({
      next: (r) => {
        this.stats[0].value = String(
          r?.totalItems ??
            r?.data?.totalItems ??
            r?.pagination?.totalItems ??
            "—",
        );
      },
    });

    this.api.get<any>("/users", { page: 1, limit: 1 }).subscribe({
      next: (r) => {
        this.stats[1].value = String(
          r?.totalItems ??
            r?.data?.totalItems ??
            r?.pagination?.totalItems ??
            "—",
        );
      },
    });

    this.api.get<any>("/authorization/roles", { page: 1, limit: 1 }).subscribe({
      next: (r) => {
        this.stats[2].value = String(
          r?.totalItems ??
            r?.data?.totalItems ??
            r?.pagination?.totalItems ??
            "—",
        );
      },
    });

    this.api
      .get<any>("/authorization/permissions", { page: 1, limit: 1 })
      .subscribe({
        next: (r) => {
          this.stats[3].value = String(
            r?.totalItems ??
              r?.data?.totalItems ??
              r?.pagination?.totalItems ??
              "—",
          );
        },
      });

    this.api.get<any>("/identity-providers", { page: 1, limit: 1 }).subscribe({
      next: (r) => {
        this.stats[4].value = String(
          r?.totalItems ??
            r?.data?.totalItems ??
            r?.pagination?.totalItems ??
            "—",
        );
      },
    });
  }
}
