import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AgGridAngular } from "ag-grid-angular";
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  CellClickedEvent,
} from "ag-grid-community";

import { ApiService } from "../../core/api.service";
import { UiService } from "../../core/ui.service";
import { PageComponent } from "../../shared/page.component";

@Component({
  selector: "app-permissions",
  standalone: true,
  imports: [FormsModule, PageComponent, AgGridAngular],
  templateUrl: "./permissions.component.html",
  styleUrl: "./permissions.component.scss",
})
export class PermissionsComponent {
  rows: any[] = [];
  loading = false;
  saving = false;
  deleting = false;
  formOpen = false;
  editMode = false;
  selected: any = null;
  private gridApi!: GridApi;

  /**
   * Static Role Types
   */
  readonly permissionTypes: string[] = ["SYSTEM", "TENANT", "ORGANIZATION"];

  form = {
    permissionName: "",
    resource: "",
    action: "",
    description: "",
  };

  /**
   * AG Grid column definitions
   */
  columnDefs: ColDef[] = [
    {
      headerName: "Permission",
      field: "permission_name",
      flex: 1.2,
      minWidth: 180,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        const permissionName = params.data?.permission_name || params.data?.permissionName || "—";

        return `
          <div class="permission-cell">
            <strong>${this.escapeHtml(permissionName)}</strong>
          </div>
        `;
      },
    },

    {
      headerName: "Resource",
      field: "resource",
      width: 150,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        const resource = params.data?.resource || params.data?.resource;

        return `
          <span class="permission-type">
            ${this.escapeHtml(resource)}
          </span>
        `;
      },
    },

    {
      headerName: "Action",
      field: "action",
      width: 150,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        const action = params.data?.action || params.data?.action;

        return `
          <span class="permission-type">
            ${this.escapeHtml(action)}
          </span>
        `;
      },
    },

    {
      headerName: "Description",
      field: "description",
      flex: 1.5,
      minWidth: 220,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        return this.escapeHtml(params.value || "—");
      },
    },

    {
      headerName: "Status",
      field: "status",
      width: 130,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        const status = params.value || "—";

        let cssClass = "badge";

        if (status === "ACTIVE") {
          cssClass += " good";
        } else if (status === "SUSPENDED") {
          cssClass += " warning";
        } else if (status === "INACTIVE" || status === "DELETED") {
          cssClass += " danger";
        }

        return `
          <span class="${cssClass}">
            ${this.escapeHtml(status)}
          </span>
        `;
      },
    },

    {
      headerName: "Actions",
      width: 190,
      minWidth: 190,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const isDeleted = params.data?.status === "DELETED";

        if (isDeleted) {
          return `
            <div class="grid-actions">
              <button
                type="button"
                class="grid-action view"
                data-action="view">
                View
              </button>
            </div>
          `;
        }

        return `
          <div class="grid-actions">
            <button
              type="button"
              class="grid-action view"
              data-action="view">
              View
            </button>

            <button
              type="button"
              class="grid-action edit"
              data-action="edit">
              Edit
            </button>

            <button
              type="button"
              class="grid-action delete"
              data-action="delete">
              Delete
            </button>
          </div>
        `;
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

  constructor(
    private api: ApiService,
    private ui: UiService,
  ) {
    this.load();
  }

  /**
   * Grid ready
   */
  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  /**
   * Load permissions from API
   */
  load(): void {
    this.loading = true;
    this.api
      .get<any>("/authorization/permissions", {
        page: 1,
        limit: 100,
      })
      .subscribe({
        next: (response) => {
          this.rows =
            response?.data?.items || response?.items || response?.data || [];
console.log("Rows ===> ", this.rows);
          this.loading = false;

          if (this.gridApi) {
            this.gridApi.setGridOption("rowData", this.rows);

            setTimeout(() => {
              this.gridApi.sizeColumnsToFit();
            });
          }
        },

        error: (error) => {
          console.error("Failed to load permissions", error);
          this.loading = false;
          this.ui.show(error?.error?.message || "Failed to load permissions");
        },
      });
  }

  /**
   * Open create modal
   */
  openCreate(): void {
    this.form = {
      permissionName: "",
      resource: "",
      action: "",
      description: "",
    };

    this.editMode = false;
    this.formOpen = true;
  }

  /**
   * Open edit modal
   */
  openEdit(permission: any): void {
    this.form = {
      permissionName: permission.permission_name || permission.permissionName || "",
      resource: permission.resource || permission.resource || "",
      action: permission.action || permission.action || "",
      description: permission.description || "",
    };

    this.selected = permission;
    this.editMode = true;
    this.formOpen = true;
  }

  /**
   * Close create/edit modal
   */
  closeCreate(): void {
    this.formOpen = false;
    this.editMode = false;
    this.selected = null;

    this.resetForm();
  }

  /**
   * Reset form
   */
  private resetForm(): void {
    this.form = {
      permissionName: "",
      resource: "",
      action: "",
      description: "",
    };
  }

  /**
   * Create or update permission
   */
  save(): void {
    if (!this.form.permissionName.trim()) {
      this.ui.show("Permission name is required");
      return;
    }

    if (!this.form.resource) {
      this.ui.show("Resource is required");
      return;
    }

    if (!this.form.action) {
      this.ui.show("Action is required");
      return;
    }
    const request = {
      permissionName: this.form.permissionName.trim(),
      resource: this.form.resource,
      action: this.form.action,
      description: this.form.description.trim(),
    };

    this.saving = true;

    if (this.editMode) {
      this.updateRole(request);
    } else {
      this.createRole(request);
    }
  }

  /**
   * Create permission
   */
  private createRole(request: any): void {
    this.api.post("/authorization/permissions", request).subscribe({
      next: () => {
        this.saving = false;
        this.closeCreate();
        this.ui.show("Role created");
        this.load();
      },

      error: (error) => {
        console.error("Failed to create permission", error);
        this.saving = false;
        this.ui.show(error?.error?.message || "Failed to create permission");
      },
    });
  }

  /**
   * Update permission
   */
  private updateRole(request: any): void {
    const permissionId = this.selected?.permission_id || this.selected?.permissionId;
    if (!permissionId) {
      this.saving = false;
      this.ui.show("Permission Id is missing");
      return;
    }

    this.api.patch(`/authorization/permissions/${permissionId}`, request).subscribe({
      next: () => {
        this.saving = false;
        this.closeCreate();
        this.ui.show("Role updated");
        this.load();
      },

      error: (error) => {
        console.error("Failed to update permission", error);
        this.saving = false;
        this.ui.show(error?.error?.message || "Failed to update permission");
      },
    });
  }

  /**
   * Handle AG Grid action buttons
   */
  onCellClicked(event: CellClickedEvent): void {
    if (event.colDef.headerName !== "Actions") {
      return;
    }
    const target = event.event?.target as HTMLElement;
    const button = target?.closest("button") as HTMLButtonElement | null;
    if (!button) {
      return;
    }

    const action = button.dataset["action"];
    const permission = event.data;
    if (action === "view") {
      this.select(permission);
    }

    if (action === "edit") {
      this.openEdit(permission);
    }

    if (action === "delete") {
      this.deleteRole(permission);
    }
  }

  /**
   * View permission
   */
  select(permission: any): void {
    const permissionId = permission?.permission_id || permission?.permissionId;

    if (!permissionId) {
      this.selected = permission;
      return;
    }

    this.api.get<any>(`/authorization/permissions/${permissionId}`).subscribe({
      next: (response) => {
        this.selected = response?.data || response;
      },

      error: (error) => {
        console.error("Failed to load permission", error);

        this.ui.show(error?.error?.message || "Failed to load permission");
      },
    });
  }

  /**
   * Close details
   */
  closeDetails(): void {
    this.selected = null;
  }

  /**
   * Soft delete permission
   *
   * Status is changed to DELETED.
   */
  deleteRole(permission: any): void {
    const permissionId = permission?.permission_id || permission?.permissionId;

    if (!permissionId) {
      this.ui.show("Role ID is missing");

      return;
    }

    const permissionName = permission?.permission_name || permission?.permissionName || "this permission";

    const confirmed = window.confirm(
      `Are you sure you want to delete "${permissionName}"?`,
    );

    if (!confirmed) {
      return;
    }

    this.deleting = true;

    this.api
      .patch(`/authorization/permissions/${permissionId}/status`, {
        status: "DELETED",
      })
      .subscribe({
        next: () => {
          this.deleting = false;

          this.ui.show("Role deleted");

          this.load();
        },

        error: (error) => {
          console.error("Failed to delete permission", error);

          this.deleting = false;

          this.ui.show(error?.error?.message || "Failed to delete permission");
        },
      });
  }

  /**
   * Convert:
   * SYSTEM -> System
   * TENANT -> Tenant
   * ORGANIZATION -> Organization
   */
  formatRoleType(permissionType: string | null | undefined): string {
    if (!permissionType) {
      return "—";
    }

    return permissionType
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Prevent HTML injection in cellRenderer.
   */
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
