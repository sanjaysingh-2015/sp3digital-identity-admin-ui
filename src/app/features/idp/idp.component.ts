import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { AgGridAngular } from "ag-grid-angular";
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  ModuleRegistry,
  AllCommunityModule,
} from "ag-grid-community";

import { ApiService } from "../../core/api.service";
import { UiService } from "../../core/ui.service";
import { PageComponent } from "../../shared/page.component";
import { ConfirmModalComponent } from "../../shared/components/confirm-modal/confirm-modal";
import { NotificationModalComponent } from "../../shared/components/notification-modal/notification-modal";

// Register AG Grid community modules
ModuleRegistry.registerModules([AllCommunityModule]);

export interface Tenant {
  tenantUuid: string;
  tenantCode: string;
  tenantName: string;
  status?: string;
  createdOn?: string;
  modifiedOn?: string;
}

export interface IdentityProvider {
  identityProviderId?: number;
  tenantUuid?: string;
  providerUuid?: string;
  providerCode: string;
  providerName: string;
  providerType: string;
  issuerUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  jwksUrl?: string;
  clientId?: string;
  clientSecret?: string;
  hasSecret?: boolean;
  secretKeyVersion?: string;
  secretRotatedOn?: string;
  scopes?: string[];
  configuration?: Record<string, any>;
  status?: string;
  createdOn?: string;
  modifiedOn?: string;
}

@Component({
  selector: "app-idp",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageComponent,
    AgGridAngular,
    ConfirmModalComponent,
    NotificationModalComponent,
  ],
  templateUrl: "./idp.component.html",
  styleUrls: ["./idp.component.scss"],
})
export class IdpComponent implements OnInit {
  // =========================================================
  // DATA
  // =========================================================

  rows: IdentityProvider[] = [];

  search = "";
  status = "";
  providerType = "";
  tenantUuid = "";

  // Server-side pagination state — the API paginates (page/limit/totalItems/
  // totalPages), so AG Grid's built-in pager can't be used as-is: it only
  // paginates whatever rows are already loaded, but a given response only
  // ever holds one page's worth (<= limit) out of totalItems.
  page = 1;
  limit = 20;
  totalItems = 0;
  totalPages = 1;

  // =========================================================
  // TENANTS
  // =========================================================

  tenants: Tenant[] = [];
  loadingTenants = false;

  loading = false;
  saving = false;
  deleting = false;
  testing = false;

  selected: IdentityProvider | null = null;
  testResult: any = null;

  // =========================================================
  // CONFIRM MODAL
  // =========================================================

  @ViewChild("confirmModal")
  confirmModal!: ConfirmModalComponent;

  private pendingDeleteProvider: IdentityProvider | null = null;

  // =========================================================
  // NOTIFICATION MODAL
  // =========================================================

  @ViewChild("notificationModal")
  notificationModal!: NotificationModalComponent;

  // =========================================================
  // CREATE / EDIT
  // =========================================================

  formOpen = false;
  editMode = false;

  form: Partial<IdentityProvider> = this.getEmptyForm();
  scopesText = "";

  // =========================================================
  // STATIC PROVIDER TYPES
  // =========================================================

  readonly providerTypes: string[] = [
    "OIDC",
    "SAML",
    "AUTH0",
    "OKTA",
    "COGNITO",
    "AZURE_AD",
  ];

  // =========================================================
  // AG GRID
  // =========================================================

  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    {
      headerName: "Provider",
      field: "providerName",
      flex: 1.5,
      minWidth: 220,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const provider = params.data;

        const name = provider?.providerName || "—";
        const code = provider?.providerCode || "—";

        return `
          <div class="ag-user-cell">
            <strong>${this.escapeHtml(name)}</strong>
            <small>${this.escapeHtml(code)}</small>
          </div>
        `;
      },
    },

    {
      headerName: "Tenant",
      flex: 1.1,
      minWidth: 180,
      sortable: false,
      filter: false,
      valueGetter: (params) => this.getTenantName(params.data?.tenantUuid),
    },

    {
      headerName: "Type",
      field: "providerType",
      flex: 0.9,
      minWidth: 130,
      sortable: true,
      filter: true,
      valueFormatter: (params) => params.value || "—",
    },

    {
      headerName: "Client ID",
      field: "clientId",
      flex: 1.2,
      minWidth: 180,
      sortable: true,
      filter: true,
      valueFormatter: (params) => params.value || "—",
    },

    {
      headerName: "Secret",
      flex: 0.7,
      minWidth: 110,
      sortable: false,
      valueGetter: (params) => (params.data?.hasSecret ? "Configured" : "Not set"),
    },

    {
      headerName: "Status",
      field: "status",
      flex: 0.8,
      minWidth: 120,
      sortable: true,
      filter: true,

      cellRenderer: (params: ICellRendererParams) => {
        const status = params.value || "—";

        let className = "ag-status-badge";

        if (status === "ACTIVE") {
          className += " good";
        } else if (status === "INACTIVE") {
          className += " warning";
        } else if (status === "DELETED") {
          className += " danger";
        }

        return `
          <span class="${className}">
            ${this.escapeHtml(status)}
          </span>
        `;
      },
    },

    {
      headerName: "Created",
      flex: 1,
      minWidth: 170,
      sortable: true,
      valueGetter: (params) => this.getCreatedDate(params.data),
    },

    {
      headerName: "Actions",
      flex: 1.6,
      minWidth: 260,
      sortable: false,
      filter: false,

      cellRenderer: (params: ICellRendererParams) => {
        const provider = params.data;

        const identityProviderId = provider?.identityProviderId;

        if (!identityProviderId) {
          return "";
        }

        const isDeleted = provider?.status === "DELETED";

        if (isDeleted) {
          return `
            <div class="ag-table-actions">
              <button
                type="button"
                class="ag-action-btn view"
                data-action="view"
              >
                View
              </button>
            </div>
          `;
        }

        const statusLabel = provider?.status === "ACTIVE" ? "Disable" : "Enable";

        return `
          <div class="ag-table-actions">

            <button
              type="button"
              class="ag-action-btn view"
              data-action="view"
            >
              View
            </button>

            <button
              type="button"
              class="ag-action-btn edit"
              data-action="edit"
            >
              Edit
            </button>

            <button
              type="button"
              class="ag-action-btn edit"
              data-action="status"
            >
              ${statusLabel}
            </button>

            <button
              type="button"
              class="ag-action-btn delete"
              data-action="delete"
            >
              Delete
            </button>

          </div>
        `;
      },

      onCellClicked: (params) => {
        const target = params.event?.target as HTMLElement;
        if (!target) {
          return;
        }
        const action = target.getAttribute("data-action");
        if (!action) {
          return;
        }
        switch (action) {
          case "view":
            this.select(params.data);
            break;

          case "edit":
            this.openEdit(params.data);
            break;

          case "status":
            this.toggleStatus(params.data);
            break;

          case "delete":
            this.deleteProvider(params.data);
            break;
        }
      },
    },
  ];

  defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true,
  };

  gridOptions = {
    rowHeight: 64,
    headerHeight: 44,
    suppressCellFocus: true,
    animateRows: true,
  };

  private readonly API_URL = "/identity-providers";

  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(
    private api: ApiService,
    private ui: UiService,
  ) {}

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {
    this.loadTenants();
    this.load();
  }

  // =========================================================
  // GRID READY
  // =========================================================

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;

    this.gridApi.sizeColumnsToFit();
  }

  // =========================================================
  // LOAD PROVIDERS
  // =========================================================

  load(page: number = this.page): void {
    this.loading = true;
    this.page = page;

    this.api
      .get<any>(this.API_URL, {
        page: this.page,
        limit: this.limit,
        search: this.search,
        status: this.status,
        providerType: this.providerType,
        tenantUuid: this.tenantUuid,
      })
      .subscribe({
        next: (response) => {
          this.rows =
            response?.data?.items ||
            response?.items ||
            response?.data ||
            response?.rows ||
            [];

          const pagination = response?.pagination;
          this.page = pagination?.page ?? this.page;
          this.limit = pagination?.limit ?? this.limit;
          this.totalItems = pagination?.totalItems ?? this.rows.length;
          this.totalPages = pagination?.totalPages ?? 1;

          this.loading = false;

          // Refresh AG Grid
          if (this.gridApi) {
            this.gridApi.setGridOption("rowData", this.rows);

            setTimeout(() => {
              this.gridApi.sizeColumnsToFit();
            });
          }
        },

        error: (error) => {
          this.loading = false;
          console.error("Failed to load identity providers:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to load identity providers",
            message: error,
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
        },
      });
  }

  // =========================================================
  // FILTER CHANGES (reset to page 1 — a stale page number could
  // otherwise land past the end of a newly-filtered result set)
  // =========================================================

  onFilterChange(): void {
    this.load(1);
  }

  // =========================================================
  // PAGINATION CONTROLS
  // =========================================================

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page || this.loading) {
      return;
    }
    this.load(page);
  }

  get hasPreviousPage(): boolean {
    return this.page > 1;
  }

  get hasNextPage(): boolean {
    return this.page < this.totalPages;
  }

  get rangeStart(): number {
    return this.totalItems === 0 ? 0 : (this.page - 1) * this.limit + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.limit, this.totalItems);
  }

  // =========================================================
  // LOAD TENANTS
  // =========================================================

  loadTenants(): void {
    this.loadingTenants = true;

    this.api.get<any>("/tenants").subscribe({
      next: (response) => {
        this.tenants = response?.data || response?.items || [];
        this.loadingTenants = false;
      },
      error: (error) => {
        this.loadingTenants = false;
        console.error("Failed to load tenants:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Failed to load tenants",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  // =========================================================
  // TENANT NAME LOOKUP
  // =========================================================

  getTenantName(tenantUuid?: string): string {
    if (!tenantUuid) {
      return "—";
    }
    const tenant = this.tenants.find((t) => t.tenantUuid === tenantUuid);
    return tenant?.tenantName || tenantUuid;
  }

  // =========================================================
  // CREATE
  // =========================================================

  openCreate(): void {
    this.editMode = false;
    this.resetForm();
    this.formOpen = true;
  }

  // =========================================================
  // EDIT
  // =========================================================

  openEdit(provider: IdentityProvider): void {
    const identityProviderId = provider?.identityProviderId;

    if (!identityProviderId) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Failed to edit provider",
        message: "Invalid identity provider ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.editMode = true;
    this.form = {
      identityProviderId,
      tenantUuid: provider.tenantUuid || "",
      providerCode: provider.providerCode || "",
      providerName: provider.providerName || "",
      providerType: provider.providerType || "OIDC",
      issuerUrl: provider.issuerUrl || "",
      authorizationUrl: provider.authorizationUrl || "",
      tokenUrl: provider.tokenUrl || "",
      jwksUrl: provider.jwksUrl || "",
      clientId: provider.clientId || "",
      clientSecret: "",
    };
    this.scopesText = provider.scopes ? provider.scopes.join(", ") : "";

    this.formOpen = true;
  }

  // =========================================================
  // CLOSE CREATE / EDIT
  // =========================================================

  closeCreate(): void {
    if (this.saving) {
      return;
    }

    this.formOpen = false;
    this.editMode = false;
    this.resetForm();
  }

  // =========================================================
  // SAVE
  // =========================================================

  save(): void {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;

    const scopes = this.scopesText
      ? this.scopesText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const request: Record<string, any> = {
      tenantUuid: this.form.tenantUuid,
      providerCode: (this.form.providerCode || "").trim(),
      providerName: (this.form.providerName || "").trim(),
      providerType: this.form.providerType,
      issuerUrl: (this.form.issuerUrl || "").trim() || undefined,
      authorizationUrl: (this.form.authorizationUrl || "").trim() || undefined,
      tokenUrl: (this.form.tokenUrl || "").trim() || undefined,
      jwksUrl: (this.form.jwksUrl || "").trim() || undefined,
      clientId: (this.form.clientId || "").trim() || undefined,
      scopes,
    };

    // Only send clientSecret when the user actually typed a new one —
    // an empty field on edit should never wipe out an existing secret.
    const clientSecret = (this.form.clientSecret || "").trim();
    if (clientSecret) {
      request["clientSecret"] = clientSecret;
    }

    // =======================================================
    // UPDATE
    // =======================================================

    if (this.editMode) {
      const identityProviderId = this.form.identityProviderId;

      if (!identityProviderId) {
        this.saving = false;
        this.ui.show("Invalid identity provider ID");
        return;
      }

      this.api.put<any>(`${this.API_URL}/${identityProviderId}`, request).subscribe({
        next: () => {
          this.saving = false;
          this.formOpen = false;
          this.editMode = false;
          this.resetForm();
          this.notificationModal.open({
            type: "SUCCESS",
            title: "Provider Updated",
            message: "Identity provider updated successfully.",
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
          this.load();
        },
        error: (error) => {
          this.saving = false;
          console.error("Failed to update identity provider:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Provider Update Failed",
            message: error,
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
        },
      });

      return;
    }

    // =======================================================
    // CREATE
    // =======================================================

    this.api.post<any>(this.API_URL, request).subscribe({
      next: () => {
        this.saving = false;
        this.formOpen = false;
        this.resetForm();
        this.notificationModal.open({
          type: "SUCCESS",
          title: "Provider Created",
          message: "Identity provider created successfully.",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
        this.load();
      },

      error: (error) => {
        this.saving = false;
        console.error("Failed to create identity provider:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Provider Creation Failed",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  // =========================================================
  // SOFT DELETE
  // =========================================================

  deleteProvider(provider: IdentityProvider): void {
    const identityProviderId = provider?.identityProviderId;
    if (!identityProviderId) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Provider deletion",
        message: "Invalid identity provider ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }
    const providerName = provider?.providerName || provider?.providerCode || "this provider";
    this.pendingDeleteProvider = provider;

    this.confirmModal.open({
      title: "Delete identity provider",
      message:
        `Are you sure you want to delete "${providerName}"?\n\n` +
        `The provider will be marked as DELETED and will not be physically removed.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
  }

  /**
   * Bound to the confirm-modal's (confirmed) output.
   * Runs the actual soft-delete once the user confirms.
   */
  onDeleteProviderConfirmed(): void {
    const provider = this.pendingDeleteProvider;

    this.pendingDeleteProvider = null;
    if (!provider) {
      return;
    }
    const identityProviderId = provider?.identityProviderId;

    if (!identityProviderId) {
      this.ui.show("Invalid identity provider ID");
      return;
    }

    this.deleting = true;
    this.api.delete<any>(`${this.API_URL}/${identityProviderId}`).subscribe({
      next: () => {
        this.deleting = false;
        this.notificationModal.open({
          type: "SUCCESS",
          title: "Provider deletion",
          message: "Identity provider deleted successfully",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
        this.load();
      },
      error: (error) => {
        this.deleting = false;
        console.error("Failed to delete identity provider:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Provider deletion",
          message: "Failed to delete identity provider",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  /**
   * Bound to the confirm-modal's (cancelled) output.
   */
  onDeleteProviderCancelled(): void {
    this.pendingDeleteProvider = null;
  }

  // =========================================================
  // ENABLE / DISABLE (status toggle)
  // =========================================================

  toggleStatus(provider: IdentityProvider): void {
    const identityProviderId = provider?.identityProviderId;
    if (!identityProviderId) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Provider status",
        message: "Invalid identity provider ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    const newStatus = provider.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    this.api
      .patch<any>(`${this.API_URL}/${identityProviderId}/status`, { status: newStatus })
      .subscribe({
        next: () => {
          this.notificationModal.open({
            type: "SUCCESS",
            title: "Provider status",
            message: `Identity provider ${newStatus === "ACTIVE" ? "enabled" : "disabled"} successfully.`,
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
          this.load();
        },
        error: (error) => {
          console.error("Failed to update provider status:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Provider status",
            message: error,
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
        },
      });
  }

  // =========================================================
  // TEST CONNECTION
  // =========================================================

  testProvider(identityProviderId?: number): void {
    if (!identityProviderId) {
      return;
    }

    this.testing = true;
    this.testResult = null;

    this.api.post<any>(`${this.API_URL}/${identityProviderId}/test`, {}).subscribe({
      next: (response) => {
        this.testResult = response?.data || response;
        this.testing = false;
      },
      error: (error) => {
        this.testing = false;
        this.testResult = {
          status: "FAILED",
          error: error?.message || "Unable to reach identity provider",
        };
      },
    });
  }

  // =========================================================
  // VIEW
  // =========================================================

  select(provider: IdentityProvider): void {
    const identityProviderId = provider?.identityProviderId;

    if (!identityProviderId) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Provider loading",
        message: "Invalid identity provider ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.loading = true;

    this.api.get<any>(`${this.API_URL}/${identityProviderId}`).subscribe({
      next: (response) => {
        this.selected = response?.data || response;
        this.testResult = null;
        this.loading = false;
      },

      error: (error) => {
        this.loading = false;
        console.error("Failed to load identity provider:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Provider loading",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  // =========================================================
  // CLOSE DETAILS
  // =========================================================

  closeDetails(): void {
    this.selected = null;
    this.testResult = null;
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  validateForm(): boolean {
    if (!this.form.tenantUuid) {
      this.ui.show("Tenant is required");
      return false;
    }

    // if (!this.form.providerCode?.trim()) {
    //   this.ui.show("Provider code is required");
    //   return false;
    // }

    // if (!/^[A-Z0-9_]+$/.test(this.form.providerCode.trim())) {
    //   this.ui.show("Provider code may only contain uppercase letters, numbers and underscores");
    //   return false;
    // }

    if (!this.form.providerName?.trim()) {
      this.ui.show("Provider name is required");
      return false;
    }

    if (!this.form.providerType) {
      this.ui.show("Provider type is required");
      return false;
    }

    return true;
  }

  // =========================================================
  // CREATED DATE
  // =========================================================

  getCreatedDate(provider: any): string {
    return provider?.created_on || provider?.createdOn || provider?.createdAt || "—";
  }

  // =========================================================
  // EMPTY FORM
  // =========================================================

  getEmptyForm(): Partial<IdentityProvider> {
    return {
      tenantUuid: "",
      providerCode: "",
      providerName: "",
      providerType: "OIDC",
      issuerUrl: "",
      authorizationUrl: "",
      tokenUrl: "",
      jwksUrl: "",
      clientId: "",
      clientSecret: "",
    };
  }

  // =========================================================
  // RESET FORM
  // =========================================================

  resetForm(): void {
    this.form = this.getEmptyForm();
    this.scopesText = "";
  }

  // =========================================================
  // HTML ESCAPING FOR CELL RENDERERS
  // =========================================================

  private escapeHtml(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
