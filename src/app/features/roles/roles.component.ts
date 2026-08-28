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
import { AssignPermissionsModalComponent } from "../../shared/components/assign-permissions-modal/assign-permissions-modal";

// Register AG Grid community modules
ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: "app-roles",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageComponent,
    AgGridAngular,
    ConfirmModalComponent,
    NotificationModalComponent,
    AssignPermissionsModalComponent,
  ],
  templateUrl: "./roles.component.html",
  styleUrls: ["./roles.component.scss"],
})
export class RolesComponent implements OnInit {
  // =========================================================
  // DATA
  // =========================================================

  rows: any[] = [];

  search = "";
  status = "";

  // Server-side pagination state — the API paginates (page/limit/totalItems/
  // totalPages), so AG Grid's built-in pager can't be used as-is: it only
  // paginates whatever rows are already loaded, but a given response only
  // ever holds one page's worth (<= limit) out of totalItems.
  page = 1;
  limit = 20;
  totalItems = 0;
  totalPages = 1;

  loading = false;
  saving = false;
  deleting = false;

  selected: any = null;

  // =========================================================
  // CONFIRM MODAL
  // =========================================================

  @ViewChild("confirmModal")
  confirmModal!: ConfirmModalComponent;

  private pendingDeleteRole: any = null;

  // =========================================================
  // NOTIFICATION MODAL
  // =========================================================

  @ViewChild("notificationModal")
  notificationModal!: NotificationModalComponent;

  // =========================================================
  // ASSIGN PERMISSIONS MODAL
  // =========================================================

  @ViewChild("assignPermissionsModal")
  assignPermissionsModal!: AssignPermissionsModalComponent;

  // =========================================================
  // CREATE / EDIT
  // =========================================================

  formOpen = false;
  editMode = false;

  form = {
    roleId: null as number | string | null,

    roleName: "",
    roleType: "TENANT",
    description: "",
  };

  // =========================================================
  // STATIC ROLE TYPES
  // =========================================================

  readonly roleTypes: string[] = ["SYSTEM", "TENANT", "ORGANIZATION"];

  // =========================================================
  // AG GRID
  // =========================================================

  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    {
      headerName: "Role",
      field: "role_name",
      flex: 1.5,
      minWidth: 220,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const role = params.data;

        const roleName = role?.role_name || role?.roleName || "—";

        return `
          <div class="ag-role-cell">
            <strong>${this.escapeHtml(roleName)}</strong>
          </div>
        `;
      },
    },

    {
      headerName: "Type",
      flex: 0.8,
      minWidth: 150,
      sortable: true,
      filter: true,
      valueGetter: (params) =>
        this.formatRoleType(params.data?.role_type || params.data?.roleType),
    },

    {
      headerName: "Description",
      field: "description",
      flex: 1.6,
      minWidth: 220,
      sortable: true,
      filter: true,
      valueFormatter: (params) => params.value || "—",
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
      headerName: "Actions",
      flex: 1.7,
      minWidth: 250,
      sortable: false,
      filter: false,

      cellRenderer: (params: ICellRendererParams) => {
        const role = params.data;

        const roleId = role?.role_id || role?.roleId;

        if (!roleId) {
          return "";
        }

        const isDeleted = role?.status === "DELETED";

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
              class="ag-action-btn assign"
              data-action="permissions"
            >
              Permissions
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

          case "permissions":
            this.openAssignPermissions(params.data);
            break;

          case "delete":
            this.deleteRole(params.data);
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
  // LOAD ROLES
  // =========================================================

  load(page: number = this.page): void {
    this.loading = true;
    this.page = page;

    this.api
      .get<any>("/authorization/roles", {
        page: this.page,
        limit: this.limit,
        search: this.search,
        status: this.status,
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
          console.error("Failed to load roles:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to load roles",
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

  openEdit(role: any): void {
    const roleId = role?.role_id || role?.roleId;

    if (!roleId) {
      this.ui.show("Invalid role ID");
      this.notificationModal.open({
        type: "WARNING",
        title: "Failed to load roles",
        message: "Invalid role ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });

      return;
    }

    this.editMode = true;

    this.form = {
      roleId,

      roleName: role?.role_name || role?.roleName || "",

      roleType: role?.role_type || role?.roleType || "TENANT",

      description: role?.description || "",
    };

    this.formOpen = true;
  }

  // =========================================================
  // ASSIGN PERMISSIONS
  // =========================================================

  openAssignPermissions(role: any): void {
    const roleId = role?.role_id || role?.roleId;

    if (!roleId) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Assign permissions",
        message: "Invalid role ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.assignPermissionsModal.open(role);
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
      roleName: this.form.roleName.trim(),

      roleType: this.form.roleType,

      description: this.form.description.trim(),
    };

    // =======================================================
    // UPDATE
    // =======================================================

    if (this.editMode) {
      const roleId = this.form.roleId;

      if (!roleId) {
        this.saving = false;
        this.notificationModal.open({
          type: "WARNING",
          title: "Failed to load roles",
          message: "Invalid role ID",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });

        return;
      }

      this.api.patch<any>(`/authorization/roles/${roleId}`, request).subscribe({
        next: () => {
          this.saving = false;
          this.formOpen = false;
          this.editMode = false;
          this.resetForm();
          this.notificationModal.open({
            type: "SUCCESS",
            title: "Failed to load roles",
            message: "Role updated successfully",
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
          this.load();
        },

        error: (error) => {
          this.saving = false;
          console.error("Failed to update role:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to update role",
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

    this.api.post<any>("/authorization/roles", request).subscribe({
      next: () => {
        this.saving = false;
        this.formOpen = false;
        this.resetForm();
        this.notificationModal.open({
          type: "SUCCESS",
          title: "Failed to create role",
          message: "Role created successfully",
          contentType: "TEXT",
          autoCloseAfter: 3000,
        });
        this.load();
      },

      error: (error) => {
        this.saving = false;
        console.error("Failed to create role:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Failed to create role",
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

  deleteRole(role: any): void {
    const roleId = role?.role_id || role?.roleId;
    if (!roleId) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Failed to delete role",
        message: "Invalid role ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }
    const roleName = role?.role_name || role?.roleName || "this role";
    this.pendingDeleteRole = role;

    this.confirmModal.open({
      title: "Delete permission",
      message:
        `Are you sure you want to delete role "${roleName}"?\n\n` +
        `The role will be marked as DELETED and will not be physically removed.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
  }

  /**
   * Bound to the confirm-modal's (confirmed) output.
   * Runs the actual soft-delete once the user confirms.
   */
  onDeleteRoleConfirmed(): void {
    const role = this.pendingDeleteRole;

    this.pendingDeleteRole = null;
    if (!role) {
      return;
    }
    const roleId = role?.role_id || role?.roleId;

    if (!roleId) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Failed to delete role",
        message: "Invalid role ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }
    this.deleting = true;
    this.api
      .patch<any>(`/authorization/roles/${roleId}/status`, {
        status: "DELETED",
      })
      .subscribe({
        next: () => {
          this.deleting = false;
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to delete role",
            message: "Role deleted successfully",
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
          this.load();
        },
        error: (error) => {
          this.deleting = false;
          console.error("Failed to delete role:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to delete role",
            message: error,
            contentType: "TEXT",
            autoCloseAfter: 3000,
          });
        },
      });
  }

  /**
   * Bound to the confirm-modal's (cancelled) output.
   */
  onDeleteRoleCancelled(): void {
    this.pendingDeleteRole = null;
  }

  // =========================================================
  // VIEW
  // =========================================================

  select(role: any): void {
    const roleId = role?.role_id || role?.roleId;

    if (!roleId) {
      this.notificationModal.open({
        type: "WARNING",
        title: "Failed to load role",
        message: "Invalid role ID",
        contentType: "TEXT",
        autoCloseAfter: 3000,
      });
      return;
    }

    this.loading = true;

    this.api.get<any>(`/authorization/roles/${roleId}`).subscribe({
      next: (response) => {
        this.selected = response?.data || response;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error("Failed to load role:", error);
        this.notificationModal.open({
          type: "ERROR",
          title: "Failed to load role",
          message: "Failed to load role details",
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
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  validateForm(): boolean {
    if (!this.form.roleName.trim()) {
      this.ui.show("Role name is required");
      return false;
    }

    if (!this.form.roleType) {
      this.ui.show("Role type is required");
      return false;
    }

    return true;
  }

  // =========================================================
  // ROLE TYPE FORMATTING
  //
  // SYSTEM -> System
  // TENANT -> Tenant
  // ORGANIZATION -> Organization
  // =========================================================

  formatRoleType(roleType: string | null | undefined): string {
    if (!roleType) {
      return "—";
    }

    return roleType
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  // =========================================================
  // RESET FORM
  // =========================================================

  resetForm(): void {
    this.form = {
      roleId: null,

      roleName: "",

      roleType: "TENANT",

      description: "",
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
