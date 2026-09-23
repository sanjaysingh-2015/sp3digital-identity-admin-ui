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

import { AppointmentApiService } from "../../core/appointment-api.service";
import { AuthService } from "../../core/auth.service";
import { PageComponent } from "../../shared/page.component";
import { NotificationModalComponent } from "../../shared/components/notification-modal/notification-modal";

ModuleRegistry.registerModules([AllCommunityModule]);

// Matches STATUSES in appointment-admin-service's appointment.validation.js
// — keep in sync if that list changes.
const APPOINTMENT_STATUSES = [
  "BOOKED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
];

@Component({
  selector: "app-appointments",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageComponent,
    AgGridAngular,
    NotificationModalComponent,
  ],
  templateUrl: "./appointments.component.html",
  styleUrls: ["./appointments.component.scss"],
})
export class AppointmentsComponent implements OnInit {
  appointmentStatuses = APPOINTMENT_STATUSES;

  // =========================================================
  // DATA
  // =========================================================

  rows: any[] = [];

  search = "";
  status = "";
  dateFrom = "";
  dateTo = "";

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
      headerName: "Patient",
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams) => {
        const row = params.data;
        return `<div class="ag-appointment-cell"><strong>${this.escapeHtml(row?.patientName)}</strong><small>${this.escapeHtml(row?.patientPhone)}</small></div>`;
      },
    },
    {
      headerName: "Date / Time",
      flex: 1.2,
      minWidth: 170,
      valueGetter: (params) => `${params.data?.appointmentDate} · ${params.data?.startTime}–${params.data?.endTime}`,
    },
    { headerName: "Token", field: "tokenNumber", flex: 0.6, minWidth: 90 },
    {
      headerName: "Tenant UUID",
      field: "tenantUuid",
      flex: 1.4,
      minWidth: 220,
    },
    { headerName: "Facility", field: "facilityId", flex: 0.7, minWidth: 100 },
    { headerName: "Channel", field: "bookingChannel", flex: 0.8, minWidth: 110 },
    {
      headerName: "Status",
      field: "status",
      flex: 0.9,
      minWidth: 140,
      cellRenderer: (params: ICellRendererParams) => {
        const status = params.value || "—";
        let className = "ag-status-badge";
        if (status === "COMPLETED" || status === "CHECKED_IN" || status === "CONFIRMED" || status === "BOOKED") className += " good";
        else if (status === "IN_PROGRESS" || status === "RESCHEDULED") className += " warning";
        else if (status === "CANCELLED" || status === "NO_SHOW") className += " danger";
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
        const action = (params.event?.target as HTMLElement)?.getAttribute("data-action");
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
    private appointmentApi: AppointmentApiService,
    public auth: AuthService,
  ) {}

  // =========================================================
  // ROLE-BASED PAGE COPY
  //
  // The actual data scoping (all tenants vs. just this one) is enforced
  // server-side by appointment-admin-service from the same JWT — see its
  // appointmentController.js#isSuperAdmin(). This is display-only.
  // =========================================================

  get isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  get pageTitle(): string {
    return this.isSuperAdmin ? "Appointments" : "My Tenant's Appointments";
  }

  get pageDescription(): string {
    return this.isSuperAdmin
      ? "All appointments across every tenant on the platform."
      : "Appointments booked within your tenant.";
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

    this.appointmentApi
      .get<any>("/appointments", {
        page: this.page,
        limit: this.limit,
        search: this.search,
        status: this.status,
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
      })
      .subscribe({
        next: (response) => {
          this.rows = response?.data || [];

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
          console.error("Failed to load appointments:", error);
          this.notificationModal.open({
            type: "ERROR",
            title: "Failed to load appointments",
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

  select(appointment: any): void {
    this.selected = appointment;
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
