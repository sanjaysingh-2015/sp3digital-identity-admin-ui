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

// Register AG Grid community modules
ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: "app-users",
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  templateUrl: "./audit.component.html",
  styleUrls: ["./audit.component.scss"],
})
export class AuditComponent implements OnInit {
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
  selectedChanges: any = null;

  // =========================================================
  // AG GRID
  // =========================================================

  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    {
      headerName: "Audit#",
      field: "audit_id",
      flex: 1.5,
      minWidth: 120,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const auditLog = params.data;

        const auditId = auditLog?.audit_id || auditLog?.auditId;

        return `
          <div class="ag-user-cell">
            ${this.escapeHtml(auditId)}
          </div>
        `;
      },
    },
    {
      headerName: "Tenant",
      field: "tenant_uuid",
      flex: 1.5,
      minWidth: 200,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const auditLog = params.data;

        const tenant = auditLog?.tenant_name || auditLog?.tenantName;

        return `
          <div class="ag-user-cell">
            ${this.escapeHtml(tenant)}
          </div>
        `;
      },
    },

    {
      headerName: "Actor",
      field: "actor_user_id",
      flex: 1.5,
      minWidth: 150,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const auditLog = params.data;

        const actorUser = auditLog?.username;

        return `
          <div class="ag-user-cell">
            ${this.escapeHtml(actorUser)}
          </div>
        `;
      },
    },

    {
      headerName: "Created",
      flex: 1,
      minWidth: 180,
      sortable: true,
      valueGetter: (params) => this.getCreatedDate(params.data),
    },

    {
      headerName: "Action",
      flex: 1.1,
      minWidth: 180,
      sortable: false,
      cellRenderer: (params: ICellRendererParams) => {
        const auditLog = params.data;

        const action = auditLog?.action || auditLog?.action;

        return `
          <div class="ag-user-cell">
            ${this.escapeHtml(action)}
          </div>
        `;
      },
    },

    {
      headerName: "Target Resource",
      flex: 0.8,
      minWidth: 180,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const auditLog = params.data;

        const targetResource =
          auditLog?.target_resource || auditLog?.targetResource;

        return `
          <div class="ag-user-cell">
            ${this.escapeHtml(targetResource)}
          </div>
        `;
      },
    },

    {
      headerName: "Changes",
      flex: 0.8,
      minWidth: 80,
      sortable: true,
      filter: true,

      cellRenderer: (params: ICellRendererParams) => {
        const changes = params.data?.changes;

        if (changes === null || changes === undefined || changes === "") {
          return `<div class="ag-user-cell"><span class="changes-empty">—</span></div>`;
        }

        return `
          <div class="ag-user-cell">
            <span class="changes-link">View JSON</span>
          </div>
        `;
      },
      // Only this column reacts to clicks; openChanges() itself no-ops on
      // null so an empty cell simply isn't clickable.
      onCellClicked: (params) => this.openChanges(params.data?.changes),
    },
  ];

  defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true,
  };

  gridOptions = {
    rowHeight: 40,
    headerHeight: 44,
    suppressCellFocus: true,
    animateRows: true,
  };

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
  // LOAD USERS
  // =========================================================

  load(page: number = this.page): void {
    this.loading = true;
    this.page = page;

    this.api
      .get<any>("/audit-logs", { page: this.page, limit: this.limit, search: this.search })
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
          console.error("Failed to load audits:", error);
          this.ui.show("Failed to load audits");
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
  // VIEW
  // =========================================================

  select(user: any): void {
    const tenantUuid = localStorage.getItem("tenantUuid");

    if (!tenantUuid) {
      this.ui.show("Invalid tenant");
      return;
    }

    this.loading = true;

    this.api.get<any>(`/audit-logs/${tenantUuid}`).subscribe({
      next: (response) => {
        this.selected = response?.data || response;
        this.loading = false;
      },

      error: (error) => {
        this.loading = false;
        console.error("Failed to load audit:", error);
        this.ui.show("Failed to load audit");
      },
    });
  }

  // =========================================================
  // CHANGES MODAL
  // =========================================================

  /**
   * `changes` can arrive as a JSON object (typical, from Sequelize's JSON
   * column) or as a raw JSON string, and can be null for actions that don't
   * carry a diff (e.g. LOGIN). Null/empty is a no-op so clicking an empty
   * cell — or a stray click event — never opens an empty modal.
   */
  openChanges(changes: any): void {
    if (changes === null || changes === undefined || changes === "") {
      return;
    }

    let parsed = changes;

    if (typeof changes === "string") {
      try {
        parsed = JSON.parse(changes);
      } catch {
        parsed = changes; // not valid JSON — show it as plain text instead
      }
    }

    this.selectedChanges = parsed;
  }

  closeChanges(): void {
    this.selectedChanges = null;
  }

  get selectedChangesFormatted(): string {
    if (typeof this.selectedChanges === "string") {
      return this.selectedChanges;
    }

    try {
      return JSON.stringify(this.selectedChanges, null, 2);
    } catch {
      return String(this.selectedChanges);
    }
  }

  // =========================================================
  // CREATED DATE
  // =========================================================

  getCreatedDate(user: any): string {
    return user?.created_on || user?.createdOn || user?.createdAt || "—";
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
