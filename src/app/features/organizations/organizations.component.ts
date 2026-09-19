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

import { OrgApiService } from "../../core/org-api.service";
import { AuthService } from "../../core/auth.service";
import { PageComponent } from "../../shared/page.component";
import { NotificationModalComponent } from "../../shared/components/notification-modal/notification-modal";

ModuleRegistry.registerModules([AllCommunityModule]);

// Matches ORGANIZATION_TYPES in organization-admin-service's
// organization.validation.js / organization-admin-ui's
// organizations.component.ts — keep in sync if either changes.
const ORGANIZATION_TYPES = [
  "STATE_HEALTH_DEPT",
  "DISTRICT_HEALTH_AUTHORITY",
  "HEALTH_NETWORK",
  "GOVERNMENT",
  "NGO",
  "PRIVATE_CHAIN",
  "OTHER",
];

@Component({
  selector: "app-organizations",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageComponent,
    AgGridAngular,
    NotificationModalComponent,
  ],
  templateUrl: "./organizations.component.html",
  styleUrls: ["./organizations.component.scss"],
})
export class OrganizationsComponent implements OnInit {
  organizationTypes = ORGANIZATION_TYPES;

  // =========================================================
  // DATA
  // =========================================================

  rows: any[] = [];

  search = "";
  status = "";
  organizationType = "";

  page = 1;
  limit = 20;
  totalItems = 0;
  totalPages = 1;

  loading = false;

  selected: any = null;

  @ViewChild("notificationModal")
  notificationModal!: NotificationModalComponent;

  // =========================================================
  // AG GRID
  // =========================================================

  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    {
      headerName: "Organization",
      field: "organizationName",
      flex: 1.6,
      minWidth: 220,
      cellRenderer: (params: ICellRendererParams) => {
        const org = params.data;
        return `<div class="ag-org-cell"><strong>${this.escapeHtml(org?.organizationName)}</strong><small>${this.escapeHtml(org?.organizationCode)}</small></div>`;
      },
    },
    { headerName: "Type", field: "organizationType", flex: 1, minWidth: 160 },
    {
      headerName: "Tenant UUID",
      field: "tenantUuid",
      flex: 1.4,
      minWidth: 220,
    },
    {
      headerName: "City",
      field: "cityName",
      flex: 1.4,
      minWidth: 100,
    },
    {
      headerName: "State",
      field: "stateName",
      flex: 1.4,
      minWidth: 100,
    },
    {
      headerName: "Country",
      field: "countryName",
      flex: 1.4,
      minWidth: 100,
    },    
    {
      headerName: "Status",
      field: "status",
      flex: 0.8,
      minWidth: 120,
      cellRenderer: (params: ICellRendererParams) => {
        const status = params.value || "—";
        let className = "ag-status-badge";
        if (status === "ACTIVE") className += " good";
        else if (status === "DISABLED") className += " warning";
        else if (status === "INACTIVE" || status === "DELETED")
          className += " danger";
        return `<span class="${className}">${this.escapeHtml(status)}</span>`;
      },
    },
    {
      headerName: "Actions",
      flex: 0.8,
      minWidth: 120,
      sortable: false,
      filter: false,
      cellRenderer: () => {
        return `<div class="ag-table-actions"><button type="button" class="ag-action-btn view" data-action="view">View</button></div>`;
      },
      onCellClicked: (params) => {
        const action = (params.event?.target as HTMLElement)?.getAttribute(
          "data-action",
        );
        if (action === "view") this.select(params.data);
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
    private orgApi: OrgApiService,
    public auth: AuthService,
  ) {}

  // =========================================================
  // ROLE-BASED PAGE COPY
  //
  // The actual data scoping (all tenants vs. just this one) is enforced
  // server-side by organization-admin-service from the same JWT — see its
  // organizationController.js#isSuperAdmin(). This is display-only: it
  // decides the heading/description, not what rows come back.
  // =========================================================

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  get pageTitle(): string {
    return this.isSuperAdmin ? "Organizations" : "My Organization";
  }

  get pageDescription(): string {
    return this.isSuperAdmin
      ? "All organizations across every tenant on the platform."
      : "The organization associated with your tenant.";
  }

  ngOnInit(): void {
    this.load();
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  load(page: number = this.page): void {
    this.loading = true;
    this.page = page;

    this.orgApi
      .get<any>("/organizations", {
        page: this.page,
        limit: this.limit,
        search: this.search,
        status: this.status,
        organizationType: this.organizationType,
      })
      .subscribe({
        next: (response) => {
          this.rows = response?.data || response?.items || response?.rows || [];

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
          console.error("Failed to load organizations:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to load organizations",
            message: error,
            contentType: "TEXT",
            autoCloseAfter: 4000,
          });
        },
      });
  }

  onFilterChange(): void {
    this.load(1);
  }

  goToPage(page: number): void {
    if (
      page < 1 ||
      page > this.totalPages ||
      page === this.page ||
      this.loading
    )
      return;
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

  select(org: any): void {
    this.selected = org;
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
