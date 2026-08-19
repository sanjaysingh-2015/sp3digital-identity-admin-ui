import { Component, OnInit } from "@angular/core";
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

// Register AG Grid community modules
ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: "app-permissions",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageComponent,
    AgGridAngular,
  ],
  templateUrl: "./permissions.component.html",
  styleUrls: ["./permissions.component.scss"],
})
export class PermissionsComponent implements OnInit {

  // =========================================================
  // DATA
  // =========================================================

  rows: any[] = [];

  loading = false;
  saving = false;
  deleting = false;

  selected: any = null;

  // =========================================================
  // CREATE / EDIT
  // =========================================================

  formOpen = false;
  editMode = false;

  form = {
    permissionId: null as number | string | null,

    permissionName: "",
    resource: "",
    action: "",
    description: "",
  };

  // =========================================================
  // STATIC RESOURCES / ACTIONS
  // =========================================================

  readonly resources: string[] = [
    "USER",
    "ROLE",
    "PERMISSION",
    "TENANT",
    "ORGANIZATION",
  ];

  readonly actions: string[] = [
    "CREATE",
    "READ",
    "UPDATE",
    "DELETE",
    "MANAGE",
  ];

  // =========================================================
  // AG GRID
  // =========================================================

  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    {
      headerName: "Permission",
      field: "permission_name",
      flex: 1.5,
      minWidth: 220,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const permission = params.data;

        const permissionName =
          permission?.permission_name ||
          permission?.permissionName ||
          "—";

        return `
          <div class="ag-permission-cell">
            <strong>${this.escapeHtml(permissionName)}</strong>
          </div>
        `;
      },
    },

    {
      headerName: "Resource",
      flex: 0.8,
      minWidth: 140,
      sortable: true,
      filter: true,
      valueGetter: (params) =>
        params.data?.resource || "—",
    },

    {
      headerName: "Action",
      flex: 0.8,
      minWidth: 140,
      sortable: true,
      filter: true,
      valueGetter: (params) =>
        params.data?.action || "—",
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
        } else if (
          status === "INACTIVE" ||
          status === "DELETED"
        ) {
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
      flex: 1.3,
      minWidth: 190,
      sortable: false,
      filter: false,

      cellRenderer: (params: ICellRendererParams) => {

        const permission = params.data;

        const permissionId =
          permission?.permission_id ||
          permission?.permissionId;

        if (!permissionId) {
          return "";
        }

        const isDeleted =
          permission?.status === "DELETED";

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
              class="ag-action-btn delete"
              data-action="delete"
            >
              Delete
            </button>

          </div>
        `;
      },

      onCellClicked: (params) => {

        const target =
          params.event?.target as HTMLElement;

        if (!target) {
          return;
        }

        const action =
          target.getAttribute("data-action");

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

          case "delete":
            this.deletePermission(params.data);
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
  // LOAD PERMISSIONS
  // =========================================================

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
            response?.data?.items ||
            response?.items ||
            response?.data ||
            response?.rows ||
            [];

          this.loading = false;

          // Refresh AG Grid
          if (this.gridApi) {
            this.gridApi.setGridOption(
              "rowData",
              this.rows,
            );

            setTimeout(() => {
              this.gridApi.sizeColumnsToFit();
            });
          }
        },

        error: (error) => {

          this.loading = false;

          console.error(
            "Failed to load permissions:",
            error,
          );

          this.ui.show(
            error?.error?.message ||
            "Failed to load permissions",
          );
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

  openEdit(permission: any): void {

    const permissionId =
      permission?.permission_id ||
      permission?.permissionId;

    if (!permissionId) {

      this.ui.show(
        "Invalid permission ID",
      );

      return;
    }

    this.editMode = true;

    this.form = {

      permissionId,

      permissionName:
        permission?.permission_name ||
        permission?.permissionName ||
        "",

      resource:
        permission?.resource || "",

      action:
        permission?.action || "",

      description:
        permission?.description || "",
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

      permissionName:
        this.form.permissionName.trim(),

      resource:
        this.form.resource,

      action:
        this.form.action,

      description:
        this.form.description.trim(),
    };

    // =======================================================
    // UPDATE
    // =======================================================

    if (this.editMode) {

      const permissionId =
        this.form.permissionId;

      if (!permissionId) {

        this.saving = false;

        this.ui.show(
          "Invalid permission ID",
        );

        return;
      }

      this.api
        .patch<any>(
          `/authorization/permissions/${permissionId}`,
          request,
        )
        .subscribe({

          next: () => {

            this.saving = false;

            this.formOpen = false;

            this.editMode = false;

            this.resetForm();

            this.ui.show(
              "Permission updated successfully",
            );

            this.load();
          },

          error: (error) => {

            this.saving = false;

            console.error(
              "Failed to update permission:",
              error,
            );

            this.ui.show(
              error?.error?.message ||
              "Failed to update permission",
            );
          },
        });

      return;
    }

    // =======================================================
    // CREATE
    // =======================================================

    this.api
      .post<any>(
        "/authorization/permissions",
        request,
      )
      .subscribe({

        next: () => {

          this.saving = false;

          this.formOpen = false;

          this.resetForm();

          this.ui.show(
            "Permission created successfully",
          );

          this.load();
        },

        error: (error) => {

          this.saving = false;

          console.error(
            "Failed to create permission:",
            error,
          );

          this.ui.show(
            error?.error?.message ||
            "Failed to create permission",
          );
        },
      });
  }

  // =========================================================
  // SOFT DELETE
  // =========================================================

  deletePermission(permission: any): void {
    const permissionId =
      permission?.permission_id ||
      permission?.permissionId;
    if (!permissionId) {
      this.ui.show(
        "Invalid permission ID",
      );
      return;
    }
    const permissionName =
      permission?.permission_name ||
      permission?.permissionName ||
      "this permission";
    const confirmed =
      window.confirm(
        `Are you sure you want to delete permission "${permissionName}"?\n\n` +
        `The permission will be marked as DELETED and will not be physically removed.`,
      );

    if (!confirmed) {
      return;
    }

    this.deleting = true;
    this.api
      .patch<any>(
        `/authorization/permissions/${permissionId}/status`,
        {
          status: "DELETED",
        },
      )
      .subscribe({
        next: () => {
          this.deleting = false;
          this.ui.show(
            "Permission deleted successfully",
          );
          this.load();
        },
        error: (error) => {
          this.deleting = false;
          console.error(
            "Failed to delete permission:",
            error,
          );
          this.ui.show(
            error?.error?.message ||
            "Failed to delete permission",
          );
        },
      });
  }

  // =========================================================
  // VIEW
  // =========================================================

  select(permission: any): void {

    const permissionId =
      permission?.permission_id ||
      permission?.permissionId;

    if (!permissionId) {

      this.ui.show(
        "Invalid permission ID",
      );

      return;
    }

    this.loading = true;

    this.api
      .get<any>(
        `/authorization/permissions/${permissionId}`,
      )
      .subscribe({

        next: (response) => {

          this.selected =
            response?.data ||
            response;

          this.loading = false;
        },

        error: (error) => {

          this.loading = false;

          console.error(
            "Failed to load permission:",
            error,
          );

          this.ui.show(
            error?.error?.message ||
            "Failed to load permission details",
          );
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

    if (!this.form.permissionName.trim()) {

      this.ui.show(
        "Permission name is required",
      );

      return false;
    }

    if (!this.form.resource) {

      this.ui.show(
        "Resource is required",
      );

      return false;
    }

    if (!this.form.action) {

      this.ui.show(
        "Action is required",
      );

      return false;
    }

    return true;
  }

  // =========================================================
  // RESET FORM
  // =========================================================

  resetForm(): void {

    this.form = {

      permissionId: null,

      permissionName: "",

      resource: "",

      action: "",

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
