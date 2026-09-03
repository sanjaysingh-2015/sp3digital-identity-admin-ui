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
}

@Component({
  selector: "app-api-clients",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageComponent,
    AgGridAngular,
    ConfirmModalComponent,
    NotificationModalComponent,
  ],
  templateUrl: "./api-clients.component.html",
  styleUrls: ["./api-clients.component.scss"],
})
export class ApiClientsComponent implements OnInit {
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

  // =========================================================
  // DATA
  // =========================================================

  rows: any[] = [];

  search = "";
  status = "";
  tenantUuid = "";

  loading = false;
  saving = false;
  deleting = false;
  rotating = false;

  selected: any = null;

  // =========================================================
  // CONFIRM MODAL
  // =========================================================

  @ViewChild("confirmModal")
  confirmModal!: ConfirmModalComponent;

  private pendingDeleteClient: any = null;
  private pendingRotateClient: any = null;

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

  form = {
    apiClientId: null as number | string | null,
    tenantUuid: "",
    clientName: "",
    clientType: "CONFIDENTIAL",
    scopes: "",
  };

  readonly clientTypes: string[] = ["CONFIDENTIAL", "PUBLIC"];

  // =========================================================
  // AG GRID
  // =========================================================

  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    {
      headerName: "Client",
      field: "client_name",
      flex: 1.5,
      minWidth: 220,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const client = params.data;

        const name = client?.client_name || client?.clientName || "—";
        const clientId = client?.client_id || client?.clientId || "—";

        return `
          <div class="ag-client-cell">
            <strong>${this.escapeHtml(name)}</strong>
            <small>${this.escapeHtml(clientId)}</small>
          </div>
        `;
      },
    },

    {
      headerName: "Type",
      flex: 0.8,
      minWidth: 130,
      sortable: true,
      filter: true,
      valueGetter: (params) =>
        params.data?.client_type || params.data?.clientType || "—",
    },

    {
      headerName: "Scopes",
      flex: 1.4,
      minWidth: 200,
      sortable: false,
      valueGetter: (params) => {
        const scopes = params.data?.scopes;
        return Array.isArray(scopes) && scopes.length
          ? scopes.join(", ")
          : "—";
      },
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
        } else if (status === "SUSPENDED") {
          className += " warning";
        } else if (status === "INACTIVE" || status === "DELETED") {
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
      valueGetter: (params) =>
        params.data?.created_on ||
        params.data?.createdOn ||
        params.data?.createdAt ||
        "—",
    },

    {
      headerName: "Actions",
      flex: 1.7,
      minWidth: 260,
      sortable: false,
      filter: false,

      cellRenderer: (params: ICellRendererParams) => {
        const client = params.data;

        const id = client?.api_client_id || client?.id;

        if (!id) {
          return "";
        }

        const isDeleted = client?.status === "DELETED";

        if (isDeleted) {
          return `
            <div class="ag-table-actions">
              <button type="button" class="ag-action-btn view" data-action="view">View</button>
            </div>
          `;
        }

        return `
          <div class="ag-table-actions">
            <button type="button" class="ag-action-btn view" data-action="view">View</button>
            <button type="button" class="ag-action-btn edit" data-action="edit">Edit</button>
            <button type="button" class="ag-action-btn assign" data-action="rotate">Rotate secret</button>
            <button type="button" class="ag-action-btn delete" data-action="delete">Delete</button>
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
          case "rotate":
            this.rotateSecret(params.data);
            break;
          case "delete":
            this.deleteClient(params.data);
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
  // LOAD API CLIENTS
  // =========================================================

  load(page: number = this.page): void {
    this.loading = true;
    this.page = page;

    this.api
      .get<any>("/api-clients", {
        page: this.page,
        limit: this.limit,
        search: this.search,
        status: this.status,
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

          if (this.gridApi) {
            this.gridApi.setGridOption("rowData", this.rows);
            setTimeout(() => this.gridApi.sizeColumnsToFit());
          }
        },
        error: (error) => {
          this.loading = false;
          console.error("Failed to load API clients:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to load API clients",
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
  // LOAD TENANTS
  // =========================================================

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

  openEdit(client: any): void {
    const id = client?.api_client_id || client?.id;

    if (!id) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Failed to edit API client",
        message: "Invalid API client ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.editMode = true;
    this.form = {
      apiClientId: id,
      tenantUuid: client?.tenant_uuid || client?.tenantUuid || "",
      clientName: client?.client_name || client?.clientName || "",
      clientType: client?.client_type || client?.clientType || "CONFIDENTIAL",
      scopes: Array.isArray(client?.scopes) ? client.scopes.join(", ") : "",
    };

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

    const request = {
      tenantUuid: this.form.tenantUuid,
      clientName: this.form.clientName.trim(),
      clientType: this.form.clientType,
      scopes: this.form.scopes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (this.editMode) {
      const id = this.form.apiClientId;
      if (!id) {
        this.saving = false;
        this.ui.show("Invalid API client ID");
        return;
      }

      this.api.patch<any>(`/api-clients/${id}`, request).subscribe({
        next: () => {
          this.saving = false;
          this.formOpen = false;
          this.editMode = false;
          this.resetForm();
          this.notificationModal.open({
            type: "SUCCESS",
            title: "API Client Updated",
            message: "API client updated successfully.",
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
          this.load();
        },
        error: (error) => {
          this.saving = false;
          console.error("Failed to update API client:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "API Client Update Failed",
            message: error,
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
        },
      });

      return;
    }

    this.api.post<any>("/api-clients", request).subscribe({
      next: (response) => {
        this.saving = false;
        this.formOpen = false;
        this.resetForm();

        const credentials = response?.data || response;

        this.notificationModal.open({
          type: "SUCCESS",
          title: "API Client Created",
          message:
            credentials?.clientSecret || credentials?.client_secret
              ? JSON.stringify(credentials)
              : "API client created successfully.",
          contentType:
            credentials?.clientSecret || credentials?.client_secret
              ? "JSON"
              : "TEXT",
        });
        this.load();
      },
      error: (error) => {
        this.saving = false;
        console.error("Failed to create API client:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "API Client Creation Failed",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  // =========================================================
  // ROTATE SECRET
  // =========================================================

  rotateSecret(client: any): void {
    const id = client?.api_client_id || client?.id;
    if (!id) {
      return;
    }

    this.pendingRotateClient = client;

    this.confirmModal.open({
      title: "Rotate client secret",
      message: `Are you sure you want to rotate the secret for "${client?.client_name || client?.clientName}"?\n\nThe existing secret will stop working immediately.`,
      confirmText: "Rotate",
      cancelText: "Cancel",
    });
  }

  // =========================================================
  // SOFT DELETE
  // =========================================================

  deleteClient(client: any): void {
    const id = client?.api_client_id || client?.id;
    if (!id) {
      this.notificationModal.open({
        type: "WARNING",
        title: "API client deletion",
        message: "Invalid API client ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.pendingDeleteClient = client;

    this.confirmModal.open({
      title: "Delete API client",
      message: `Are you sure you want to delete "${client?.client_name || client?.clientName}"?\n\nThe client will be marked as DELETED and will not be physically removed.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
  }

  /**
   * Bound to the confirm-modal's (confirmed) output. Handles both the
   * rotate-secret and delete flows since only one can be pending at a time.
   */
  onConfirmed(): void {
    if (this.pendingRotateClient) {
      const client = this.pendingRotateClient;
      this.pendingRotateClient = null;
      const id = client?.api_client_id || client?.id;

      this.rotating = true;
      this.api.post<any>(`/api-clients/${id}/rotate-secret`).subscribe({
        next: (response) => {
          this.rotating = false;
          const data = response?.data || response;
          this.notificationModal.open({
            type: "SUCCESS",
            title: "Secret Rotated",
            message: data?.clientSecret || data?.client_secret
              ? JSON.stringify(data)
              : "Client secret rotated successfully.",
            contentType: data?.clientSecret || data?.client_secret ? "JSON" : "TEXT",
          });
          this.load();
        },
        error: (error) => {
          this.rotating = false;
          console.error("Failed to rotate secret:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Secret Rotation Failed",
            message: error,
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
        },
      });

      return;
    }

    const client = this.pendingDeleteClient;
    this.pendingDeleteClient = null;
    if (!client) {
      return;
    }
    const id = client?.api_client_id || client?.id;

    this.deleting = true;
    this.api.patch<any>(`/api-clients/${id}/status`, { status: "DELETED" }).subscribe({
      next: () => {
        this.deleting = false;
        this.notificationModal.open({
          type: "SUCCESS",
          title: "API Client Deleted",
          message: "API client deleted successfully.",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
        this.load();
      },
      error: (error) => {
        this.deleting = false;
        console.error("Failed to delete API client:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "API Client Deletion Failed",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  onCancelled(): void {
    this.pendingDeleteClient = null;
    this.pendingRotateClient = null;
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
  // VIEW
  // =========================================================

  select(client: any): void {
    const id = client?.api_client_id || client?.id;
    if (!id) {
      this.notificationModal.open({
        type: "WARNING",
        title: "API client loading",
        message: "Invalid API client ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.loading = true;

    this.api.get<any>(`/api-clients/${id}`).subscribe({
      next: (response) => {
        this.selected = response?.data || response;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error("Failed to load API client:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "API client loading",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  closeDetails(): void {
    this.selected = null;
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  validateForm(): boolean {
    if (!this.form.tenantUuid) {
      this.ui.show("Tenant is required");
      return false;
    }
    if (!this.form.clientName.trim()) {
      this.ui.show("Client name is required");
      return false;
    }
    if (!this.form.clientType) {
      this.ui.show("Client type is required");
      return false;
    }
    return true;
  }

  // =========================================================
  // RESET FORM
  // =========================================================

  resetForm(): void {
    this.form = {
      apiClientId: null,
      tenantUuid: "",
      clientName: "",
      clientType: "CONFIDENTIAL",
      scopes: "",
    };
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
