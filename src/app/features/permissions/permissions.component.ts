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

interface ResourceOption {
  resourceCode: string;
  resourceName: string;
  description?: string | null;
  resourceCategory?: string;
  status?: string;
}

interface ActionOption {
  actionCode: string;
  actionName: string;
  description?: string | null;
  actionCategory?: string;
  status?: string;
}

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

    resourceCategory: "",
    resources: [] as string[],   // create mode (multi-select)
    resource: "",                 // edit mode (single-select)

    actionCategory: "",
    actions: [] as string[],      // create mode (multi-select)
    action: "",                   // edit mode (single-select)

    description: "",

    allowDuplicates: false,
  };

  // =========================================================
  // RESOURCE CATEGORY / RESOURCE (CASCADING)
  // =========================================================

  resourceCategories: string[] = [];
  resourceOptions: ResourceOption[] = [];

  loadingResourceCategories = false;
  loadingResources = false;

  // =========================================================
  // ACTION CATEGORY / ACTION (CASCADING)
  // =========================================================

  actionCategories: string[] = [];
  actionOptions: ActionOption[] = [];

  loadingActionCategories = false;
  loadingActions = false;

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

    this.loadResourceCategories();
    this.loadActionCategories();
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
  // RESOURCE CATEGORIES
  // =========================================================

  loadResourceCategories(): void {
    this.loadingResourceCategories = true;
    this.api
      .get<any>("/resources/categories")
      .subscribe({
        next: (response) => {
          this.resourceCategories =
            response?.data ||
            response ||
            [];
          this.loadingResourceCategories = false;
        },
        error: (error) => {

          this.loadingResourceCategories = false;

          console.error(
            "Failed to load resource categories:",
            error,
          );

          this.ui.show(
            error?.error?.message ||
            "Failed to load resource categories",
          );
        },
      });
  }

  // =========================================================
  // RESOURCES FOR A CATEGORY
  // =========================================================

  loadResourcesForCategory(category: string): void {

    if (!category) {
      this.resourceOptions = [];
      return;
    }

    this.loadingResources = true;

    this.api
      .get<any>(
        `/resources/category/${category}`,
      )
      .subscribe({

        next: (response) => {

          this.resourceOptions =
            response?.data ||
            response ||
            [];

          this.loadingResources = false;
        },

        error: (error) => {

          this.loadingResources = false;

          console.error(
            "Failed to load resources:",
            error,
          );

          this.ui.show(
            error?.error?.message ||
            "Failed to load resources",
          );
        },
      });
  }

  /**
   * Triggered when the user changes the resource category
   * in the create/edit form. Resets whichever selection field
   * applies to the current mode (multi-select for create,
   * single-select for edit).
   */
  onResourceCategoryChange(): void {

    if (this.editMode) {
      this.form.resource = "";
    } else {
      this.form.resources = [];
    }

    this.loadResourcesForCategory(this.form.resourceCategory);
  }

  // =========================================================
  // ACTION CATEGORIES
  // =========================================================

  loadActionCategories(): void {

    this.loadingActionCategories = true;

    this.api
      .get<any>("/actions/categories")
      .subscribe({

        next: (response) => {

          this.actionCategories =
            response?.data ||
            response ||
            [];

          this.loadingActionCategories = false;
        },

        error: (error) => {

          this.loadingActionCategories = false;

          console.error(
            "Failed to load action categories:",
            error,
          );

          this.ui.show(
            error?.error?.message ||
            "Failed to load action categories",
          );
        },
      });
  }

  // =========================================================
  // ACTIONS FOR A CATEGORY
  // =========================================================

  loadActionsForCategory(category: string): void {

    if (!category) {
      this.actionOptions = [];
      return;
    }

    this.loadingActions = true;

    this.api
      .get<any>(
        `/actions/category/${category}`,
      )
      .subscribe({

        next: (response) => {

          this.actionOptions =
            response?.data ||
            response ||
            [];

          this.loadingActions = false;
        },

        error: (error) => {

          this.loadingActions = false;

          console.error(
            "Failed to load actions:",
            error,
          );

          this.ui.show(
            error?.error?.message ||
            "Failed to load actions",
          );
        },
      });
  }

  /**
   * Triggered when the user changes the action category
   * in the create/edit form. Resets whichever selection field
   * applies to the current mode (multi-select for create,
   * single-select for edit).
   */
  onActionCategoryChange(): void {

    if (this.editMode) {
      this.form.action = "";
    } else {
      this.form.actions = [];
    }

    this.loadActionsForCategory(this.form.actionCategory);
  }

  // =========================================================
  // CREATE
  // =========================================================

  openCreate(): void {

    this.editMode = false;

    this.resetForm();

    this.resourceOptions = [];
    this.actionOptions = [];

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

    const resourceCategory =
      permission?.resource_category ||
      permission?.resourceCategory ||
      "";

    const actionCategory =
      permission?.action_category ||
      permission?.actionCategory ||
      "";

    this.form = {

      permissionId,

      permissionName:
        permission?.permission_name ||
        permission?.permissionName ||
        "",

      resourceCategory,
      resources: [],

      resource:
        permission?.resource ||
        permission?.resourceCode ||
        (permission?.resources || [])[0] ||
        "",

      actionCategory,
      actions: [],

      action:
        permission?.action ||
        permission?.actionCode ||
        (permission?.actions || [])[0] ||
        "",

      description:
        permission?.description || "",

      allowDuplicates:
        permission?.allow_duplicates ||
        permission?.allowDuplicates ||
        false,
    };

    // Load the option lists for the pre-selected categories.
    // The single-select fields above already hold the existing
    // value, so it will show as selected once options arrive.
    this.loadResourcesForCategory(resourceCategory);
    this.loadActionsForCategory(actionCategory);

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

    const request: any = {
      permissionName:
        this.form.permissionName.trim(),
      resourceCategory:
        this.form.resourceCategory,
      actionCategory:
        this.form.actionCategory,
      description:
        this.form.description.trim(),
      allowDuplicates:
        this.form.allowDuplicates,
    };

    // Edit mode: a row is a single resource/action pair.
    // Create mode: multiple resources/actions can be selected
    // to bulk-create one permission per combination.
    if (this.editMode) {
      request.resource = this.form.resource;
      request.action = this.form.action;
    } else {
      request.resources = this.form.resources;
      request.actions = this.form.actions;
    }

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

    if (!this.form.resourceCategory) {

      this.ui.show(
        "Resource category is required",
      );

      return false;
    }

    if (this.editMode) {

      if (!this.form.resource) {

        this.ui.show(
          "Resource is required",
        );

        return false;
      }

    } else if (!this.form.resources.length) {

      this.ui.show(
        "At least one resource is required",
      );

      return false;
    }

    if (!this.form.actionCategory) {

      this.ui.show(
        "Action category is required",
      );

      return false;
    }

    if (this.editMode) {

      if (!this.form.action) {

        this.ui.show(
          "Action is required",
        );

        return false;
      }

    } else if (!this.form.actions.length) {

      this.ui.show(
        "At least one action is required",
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

      resourceCategory: "",
      resources: [],
      resource: "",

      actionCategory: "",
      actions: [],
      action: "",

      description: "",

      allowDuplicates: false,
    };
  }

  // =========================================================
  // LABEL FORMATTING
  //
  // ASSIGN_ROLE -> Assign Role
  // HEALTHCARE_NOTIFICATION -> Healthcare Notification
  // =========================================================

  formatLabel(value: string | null | undefined): string {

    if (!value) {
      return "—";
    }

    return value
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Resolve a resource code to its display name, falling back
   * to a formatted version of the code when the option list
   * (e.g. on the details view) isn't loaded.
   */
  resourceLabel(code: string): string {

    const match = this.resourceOptions.find(
      (option) => option.resourceCode === code,
    );

    return match?.resourceName || this.formatLabel(code);
  }

  /**
   * Resolve an action code to its display name, falling back
   * to a formatted version of the code when the option list
   * (e.g. on the details view) isn't loaded.
   */
  actionLabel(code: string): string {

    const match = this.actionOptions.find(
      (option) => option.actionCode === code,
    );

    return match?.actionName || this.formatLabel(code);
  }

  /**
   * Display label for a permission row's single resource,
   * used on the details view. Falls back to the first entry
   * of a legacy resources[] array if present.
   */
  resourceDisplayLabel(permission: any): string {

    const code =
      permission?.resource ||
      permission?.resourceCode ||
      (permission?.resources || [])[0];

    if (!code) {
      return "—";
    }

    return this.resourceLabel(code);
  }

  /**
   * Display label for a permission row's single action,
   * used on the details view. Falls back to the first entry
   * of a legacy actions[] array if present.
   */
  actionDisplayLabel(permission: any): string {

    const code =
      permission?.action ||
      permission?.actionCode ||
      (permission?.actions || [])[0];

    if (!code) {
      return "—";
    }

    return this.actionLabel(code);
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
