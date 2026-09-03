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
  selector: "app-service-accounts",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageComponent,
    AgGridAngular,
    ConfirmModalComponent,
    NotificationModalComponent,
  ],
  templateUrl: "./service-accounts.component.html",
  styleUrls: ["./service-accounts.component.scss"],
})
export class ServiceAccountsComponent implements OnInit {
  page = 1;
  limit = 20;
  totalItems = 0;
  totalPages = 1;

  tenants: Tenant[] = [];
  loadingTenants = false;

  rows: any[] = [];

  search = "";
  status = "";
  tenantUuid = "";

  loading = false;
  saving = false;
  deleting = false;

  selected: any = null;

  @ViewChild("confirmModal")
  confirmModal!: ConfirmModalComponent;

  private pendingDeleteAccount: any = null;

  @ViewChild("notificationModal")
  notificationModal!: NotificationModalComponent;

  formOpen = false;
  editMode = false;

  form = {
    serviceAccountId: null as number | string | null,
    tenantUuid: "",
    accountName: "",
    serviceCode: "",
    organizationId: "",
  };

  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    {
      headerName: "Account",
      field: "account_name",
      flex: 1.5,
      minWidth: 220,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const account = params.data;
        const name = account?.account_name || account?.accountName || "—";
        const code = account?.service_code || account?.serviceCode || "—";

        return `
          <div class="ag-account-cell">
            <strong>${this.escapeHtml(name)}</strong>
            <small>${this.escapeHtml(code)}</small>
          </div>
        `;
      },
    },
    {
      headerName: "Organization",
      flex: 1.2,
      minWidth: 180,
      sortable: true,
      filter: true,
      valueGetter: (params) =>
        params.data?.organization_id || params.data?.organizationId || "—",
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
        if (status === "ACTIVE") className += " good";
        else if (status === "SUSPENDED") className += " warning";
        else if (status === "INACTIVE" || status === "DELETED") className += " danger";

        return `<span class="${className}">${this.escapeHtml(status)}</span>`;
      },
    },
    {
      headerName: "Expires",
      flex: 1,
      minWidth: 160,
      sortable: true,
      valueGetter: (params) => params.data?.expires_on || params.data?.expiresOn || "—",
    },
    {
      headerName: "Actions",
      flex: 1.4,
      minWidth: 220,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams) => {
        const account = params.data;
        const id = account?.service_account_id || account?.id;
        if (!id) return "";

        const isDeleted = account?.status === "DELETED";
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
            <button type="button" class="ag-action-btn delete" data-action="delete">Delete</button>
          </div>
        `;
      },
      onCellClicked: (params) => {
        const target = params.event?.target as HTMLElement;
        if (!target) return;
        const action = target.getAttribute("data-action");
        if (!action) return;
        switch (action) {
          case "view":
            this.select(params.data);
            break;
          case "edit":
            this.openEdit(params.data);
            break;
          case "delete":
            this.deleteAccount(params.data);
            break;
        }
      },
    },
  ];

  defaultColDef: ColDef = { resizable: true, sortable: true, filter: true };

  gridOptions = {
    rowHeight: 64,
    headerHeight: 44,
    suppressCellFocus: true,
    animateRows: true,
  };

  constructor(
    private api: ApiService,
    private ui: UiService,
  ) {}

  ngOnInit(): void {
    this.loadTenants();
    this.load();
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  load(page: number = this.page): void {
    this.loading = true;
    this.page = page;

    this.api
      .get<any>("/service-accounts", {
        page: this.page,
        limit: this.limit,
        search: this.search,
        status: this.status,
        tenantUuid: this.tenantUuid,
      })
      .subscribe({
        next: (response) => {
          this.rows =
            response?.data?.items || response?.items || response?.data || response?.rows || [];

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
          console.error("Failed to load service accounts:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to load service accounts",
            message: error,
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
        },
      });
  }

  onFilterChange(): void {
    this.load(1);
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

  openCreate(): void {
    this.editMode = false;
    this.resetForm();
    this.formOpen = true;
  }

  openEdit(account: any): void {
    const id = account?.service_account_id || account?.id;
    if (!id) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Failed to edit service account",
        message: "Invalid service account ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.editMode = true;
    this.form = {
      serviceAccountId: id,
      tenantUuid: account?.tenant_uuid || account?.tenantUuid || "",
      accountName: account?.account_name || account?.accountName || "",
      serviceCode: account?.service_code || account?.serviceCode || "",
      organizationId: account?.organization_id || account?.organizationId || "",
    };

    this.formOpen = true;
  }

  closeCreate(): void {
    if (this.saving) return;
    this.formOpen = false;
    this.editMode = false;
    this.resetForm();
  }

  save(): void {
    if (!this.validateForm()) return;

    this.saving = true;

    const request = {
      tenantUuid: this.form.tenantUuid,
      accountName: this.form.accountName.trim(),
      serviceCode: this.form.serviceCode.trim(),
      organizationId: this.form.organizationId.trim(),
    };

    if (this.editMode) {
      const id = this.form.serviceAccountId;
      if (!id) {
        this.saving = false;
        this.ui.show("Invalid service account ID");
        return;
      }

      this.api.patch<any>(`/service-accounts/${id}`, request).subscribe({
        next: () => {
          this.saving = false;
          this.formOpen = false;
          this.editMode = false;
          this.resetForm();
          this.notificationModal.open({
            type: "SUCCESS",
            title: "Service Account Updated",
            message: "Service account updated successfully.",
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
          this.load();
        },
        error: (error) => {
          this.saving = false;
          console.error("Failed to update service account:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Service Account Update Failed",
            message: error,
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
        },
      });
      return;
    }

    this.api.post<any>("/service-accounts", request).subscribe({
      next: () => {
        this.saving = false;
        this.formOpen = false;
        this.resetForm();
        this.notificationModal.open({
          type: "SUCCESS",
          title: "Service Account Created",
          message: "Service account created successfully.",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
        this.load();
      },
      error: (error) => {
        this.saving = false;
        console.error("Failed to create service account:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Service Account Creation Failed",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  deleteAccount(account: any): void {
    const id = account?.service_account_id || account?.id;
    if (!id) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Service account deletion",
        message: "Invalid service account ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.pendingDeleteAccount = account;
    this.confirmModal.open({
      title: "Delete service account",
      message: `Are you sure you want to delete "${account?.account_name || account?.accountName}"?\n\nThe account will be marked as DELETED and will not be physically removed.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
  }

  onDeleteConfirmed(): void {
    const account = this.pendingDeleteAccount;
    this.pendingDeleteAccount = null;
    if (!account) return;
    const id = account?.service_account_id || account?.id;

    this.deleting = true;
    this.api.patch<any>(`/service-accounts/${id}/status`, { status: "DELETED" }).subscribe({
      next: () => {
        this.deleting = false;
        this.notificationModal.open({
          type: "SUCCESS",
          title: "Service Account Deleted",
          message: "Service account deleted successfully.",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
        this.load();
      },
      error: (error) => {
        this.deleting = false;
        console.error("Failed to delete service account:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Service Account Deletion Failed",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  onDeleteCancelled(): void {
    this.pendingDeleteAccount = null;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page || this.loading) return;
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

  select(account: any): void {
    const id = account?.service_account_id || account?.id;
    if (!id) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Service account loading",
        message: "Invalid service account ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.loading = true;
    this.api.get<any>(`/service-accounts/${id}`).subscribe({
      next: (response) => {
        this.selected = response?.data || response;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error("Failed to load service account:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Service account loading",
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

  validateForm(): boolean {
    if (!this.form.tenantUuid) {
      this.ui.show("Tenant is required");
      return false;
    }
    if (!this.form.accountName.trim()) {
      this.ui.show("Account name is required");
      return false;
    }
    if (!this.form.serviceCode.trim()) {
      this.ui.show("Service code is required");
      return false;
    }
    return true;
  }

  resetForm(): void {
    this.form = {
      serviceAccountId: null,
      tenantUuid: "",
      accountName: "",
      serviceCode: "",
      organizationId: "",
    };
  }

  private escapeHtml(value: any): string {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
