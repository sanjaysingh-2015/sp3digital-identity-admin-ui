import { Component, ViewChild } from "@angular/core";
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
import { PageComponent } from "../../shared/page.component";
import { ConfirmModalComponent } from "../../shared/components/confirm-modal/confirm-modal";
import { NotificationModalComponent } from "../../shared/components/notification-modal/notification-modal";

// Register AG Grid community modules
ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: "app-sessions",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageComponent,
    AgGridAngular,
    ConfirmModalComponent,
    NotificationModalComponent,
  ],
  templateUrl: "./sessions.component.html",
  styleUrls: ["./sessions.component.scss"],
})
export class SessionsComponent {
  // Sessions are scoped to a single user at a time, so pagination is
  // simpler than the tenant-wide list pages — one server page per navigation,
  // keyed by the currently searched user ID.
  page = 1;
  limit = 20;
  totalItems = 0;
  totalPages = 1;

  rows: any[] = [];

  userId: number | null = null;
  status = "";

  loading = false;
  revoking = false;
  searched = false;

  selected: any = null;

  @ViewChild("confirmModal")
  confirmModal!: ConfirmModalComponent;

  private pendingRevokeSession: any = null;

  @ViewChild("notificationModal")
  notificationModal!: NotificationModalComponent;

  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    {
      headerName: "Session",
      flex: 1.4,
      minWidth: 220,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const session = params.data;
        const id = session?.session_id || session?.id || "—";
        const device = session?.device || session?.userAgent || session?.user_agent || "";

        return `
          <div class="ag-session-cell">
            <strong>${this.escapeHtml(id)}</strong>
            <small>${this.escapeHtml(device || "—")}</small>
          </div>
        `;
      },
    },
    {
      headerName: "IP address",
      flex: 1,
      minWidth: 150,
      sortable: true,
      filter: true,
      valueGetter: (params) => params.data?.ip_address || params.data?.ipAddress || "—",
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
        else if (status === "EXPIRED" || status === "REVOKED") className += " danger";

        return `<span class="${className}">${this.escapeHtml(status)}</span>`;
      },
    },
    {
      headerName: "Created",
      flex: 1,
      minWidth: 170,
      sortable: true,
      valueGetter: (params) =>
        params.data?.created_on || params.data?.createdOn || params.data?.createdAt || "—",
    },
    {
      headerName: "Expires",
      flex: 1,
      minWidth: 170,
      sortable: true,
      valueGetter: (params) =>
        params.data?.expires_on || params.data?.expiresOn || params.data?.expiresAt || "—",
    },
    {
      headerName: "Actions",
      flex: 1.2,
      minWidth: 180,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams) => {
        const session = params.data;
        const id = session?.session_id || session?.id;
        if (!id) return "";

        if (session?.status !== "ACTIVE") {
          return `
            <div class="ag-table-actions">
              <button type="button" class="ag-action-btn view" data-action="view">View</button>
            </div>
          `;
        }

        return `
          <div class="ag-table-actions">
            <button type="button" class="ag-action-btn view" data-action="view">View</button>
            <button type="button" class="ag-action-btn delete" data-action="revoke">Revoke</button>
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
          case "revoke":
            this.revokeSession(params.data);
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

  constructor(private api: ApiService) {}

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  // =========================================================
  // LOAD SESSIONS FOR A USER
  // =========================================================

  load(page: number = this.page): void {
    if (!this.userId) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Load sessions",
        message: "Enter a user ID to load sessions.",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.loading = true;
    this.searched = true;
    this.page = page;

    this.api
      .get<any>(`/users/${this.userId}/sessions`, {
        page: this.page,
        limit: this.limit,
        status: this.status,
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
          console.error("Failed to load sessions:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to load sessions",
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

  // =========================================================
  // REVOKE
  // =========================================================

  revokeSession(session: any): void {
    const id = session?.session_id || session?.id;
    if (!id) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Session revocation",
        message: "Invalid session ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.pendingRevokeSession = session;
    this.confirmModal.open({
      title: "Revoke session",
      message: `Are you sure you want to revoke session "${id}"?\n\nThe user will be signed out on that device immediately.`,
      confirmText: "Revoke",
      cancelText: "Cancel",
    });
  }

  onRevokeConfirmed(): void {
    const session = this.pendingRevokeSession;
    this.pendingRevokeSession = null;
    if (!session) return;
    const id = session?.session_id || session?.id;

    this.revoking = true;
    this.api.post<any>(`/sessions/${id}/revoke`).subscribe({
      next: () => {
        this.revoking = false;
        this.notificationModal.open({
          type: "SUCCESS",
          title: "Session Revoked",
          message: "Session revoked successfully.",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
        this.load();
      },
      error: (error) => {
        this.revoking = false;
        console.error("Failed to revoke session:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Session Revocation Failed",
          message: error,
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
      },
    });
  }

  onRevokeCancelled(): void {
    this.pendingRevokeSession = null;
  }

  // =========================================================
  // PAGINATION CONTROLS
  // =========================================================

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

  // =========================================================
  // VIEW
  // =========================================================

  select(session: any): void {
    this.selected = session;
  }

  closeDetails(): void {
    this.selected = null;
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
