import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { ApiService } from "../../../core/api.service";
import { UiService } from "../../../core/ui.service";

/**
 * AssignPermissionsModalComponent
 * ---------------------------------------------------------
 * Reusable "many-to-many" assignment dialog that lets an admin
 * assign / revoke permissions for a single role.
 *
 * NOTE: unlike AssignRolesModalComponent (which reuses your
 * existing /users/:userId/roles endpoints), the role<->permission
 * junction endpoints below do NOT exist yet on the backend.
 * They are designed to mirror the existing user<->role pattern
 * exactly:
 *
 *   GET   /authorization/roles/:roleId/permissions
 *   POST  /authorization/roles/:roleId/permissions           { permissionId }
 *   PATCH /authorization/roles/:roleId/permissions/:rolePermissionId  { status: 'INACTIVE' }
 *
 * See role-permissions.backend-additions.js for the matching
 * service / controller / route code to add on the backend.
 *
 * Usage (from a parent component):
 *
 *   <app-assign-permissions-modal #assignPermissionsModal></app-assign-permissions-modal>
 *
 *   @ViewChild('assignPermissionsModal') assignPermissionsModal!: AssignPermissionsModalComponent;
 *   openAssignPermissions(role) { this.assignPermissionsModal.open(role); }
 */
@Component({
  selector: "app-assign-permissions-modal",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./assign-permissions-modal.html",
  styleUrls: ["./assign-permissions-modal.css"],
})
export class AssignPermissionsModalComponent {
  visible = false;

  role: any = null;

  search = "";

  loading = false;
  private busyPermissionId: number | string | null = null;

  allPermissions: any[] = [];

  // permissionId -> rolePermissionId, for permissions currently assigned to the role
  private assignedMap: Record<string, number | string> = {};

  constructor(
    private api: ApiService,
    private ui: UiService,
  ) {}

  // =========================================================
  // OPEN / CLOSE
  // =========================================================

  open(role: any): void {
    const roleId = role?.role_id || role?.roleId;

    if (!roleId) {
      this.ui.show("Invalid role ID");
      return;
    }

    this.role = role;
    this.search = "";
    this.assignedMap = {};
    this.visible = true;

    this.loadPermissions();
    this.loadAssignments();
  }

  close(): void {
    this.visible = false;
    this.role = null;
  }

  // =========================================================
  // DATA LOADING
  // =========================================================

  private loadPermissions(): void {
    this.loading = true;

    this.api
      .get<any>("/authorization/permissions", { page: 1, limit: 200 })
      .subscribe({
        next: (response) => {
          const rows =
            response?.data?.items ||
            response?.items ||
            response?.data ||
            response?.rows ||
            [];

          this.allPermissions = rows.filter(
            (permission: any) => (permission?.status || "ACTIVE") === "ACTIVE",
          );
          this.loading = false;
        },
        error: (error) => {
          this.loading = false;
          console.error("Failed to load permissions:", error);
          this.ui.show("Failed to load permissions");
        },
      });
  }

  private loadAssignments(): void {
    const roleId = this.getRoleId();
    if (!roleId) {
      return;
    }

    this.api.get<any>(`/authorization/roles/${roleId}/permissions`).subscribe({
      next: (response) => {
        const items =
          response?.items || response?.data?.items || response?.data || [];

        const map: Record<string, number | string> = {};
        items.forEach((assignment: any) => {
          const permissionId =
            assignment?.permissionId ?? assignment?.permission_id;
          const rolePermissionId =
            assignment?.rolePermissionId ?? assignment?.role_permission_id;
          console.log("Permission Id ==> ", permissionId);
          console.log("Role Permission Id ==> ", rolePermissionId);
          if (
            permissionId !== undefined &&
            permissionId !== null &&
            rolePermissionId !== undefined
          ) {
            map[String(permissionId)] = rolePermissionId;
          }
        });
        this.assignedMap = map;
      },
      error: (error) => {
        console.error("Failed to load assigned permissions:", error);
        this.ui.show("Failed to load assigned permissions");
      },
    });
  }

  // =========================================================
  // TOGGLE ASSIGN / REVOKE
  // =========================================================

  isAssigned(permission: any): boolean {
    const permissionId = permission?.permission_id ?? permission?.permissionId;
    return (
      permissionId !== undefined &&
      this.assignedMap[String(permissionId)] !== undefined
    );
  }

  isBusy(permission: any): boolean {
    const permissionId = permission?.permission_id ?? permission?.permissionId;
    return (
      this.busyPermissionId !== null &&
      String(this.busyPermissionId) === String(permissionId)
    );
  }

  toggle(permission: any): void {
    const roleId = this.getRoleId();
    const permissionId = permission?.permission_id ?? permission?.permissionId;

    if (!roleId || permissionId === undefined || permissionId === null) {
      this.ui.show("Invalid permission selection");
      return;
    }

    if (this.busyPermissionId !== null) {
      return;
    }

    this.busyPermissionId = permissionId;

    const rolePermissionId = this.assignedMap[String(permissionId)];

    if (rolePermissionId !== undefined) {
      // ===================== REVOKE =====================
      this.api
        .post<any>(`/authorization/roles/${roleId}/permissions`, {
          permissionIds: [permissionId],
        })
        .subscribe({
          next: () => {
            this.busyPermissionId = null;

            this.ui.show(
              `"${this.getPermissionName(permission)}" assigned to ${this.getRoleLabel()}`,
            );
          },
          error: (error) => {
            this.busyPermissionId = null;
            console.error("Failed to assign permission:", error);
            this.ui.show("Failed to assign permission");
          },
        });
    } else {
      // ===================== ASSIGN =====================
      this.api
        .post<any>(`/authorization/roles/${roleId}/permissions`, {
          permissionIds: [permissionId],
        })
        .subscribe({
          next: (response) => {
            const newRolePermissionId =
              response?.rolePermissionId ??
              response?.data?.rolePermissionId ??
              response?.role_permission_id;
            this.assignedMap[String(permissionId)] =
              newRolePermissionId ?? true;
            this.busyPermissionId = null;
            this.ui.show(
              `Assigned "${this.getPermissionName(permission)}" to ${this.getRoleLabel()}`,
            );
          },
          error: (error) => {
            this.busyPermissionId = null;
            console.error("Failed to assign permission:", error);
            this.ui.show("Failed to assign permission");
          },
        });
    }
  }

  // =========================================================
  // FILTERING
  // =========================================================

  get filteredPermissions(): any[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.allPermissions;
    }
    return this.allPermissions.filter((permission) => {
      const name = (
        permission?.permission_name ||
        permission?.permissionName ||
        ""
      ).toLowerCase();
      const resource = (permission?.resource || "").toLowerCase();
      const action = (permission?.action || "").toLowerCase();
      return (
        name.includes(term) || resource.includes(term) || action.includes(term)
      );
    });
  }

  // =========================================================
  // HELPERS
  // =========================================================

  private getRoleId(): number | string | null {
    return this.role?.role_id || this.role?.roleId || null;
  }

  getRoleLabel(): string {
    if (!this.role) {
      return "role";
    }
    return this.role?.role_name || this.role?.roleName || "this role";
  }

  getPermissionName(permission: any): string {
    return permission?.permission_name || permission?.permissionName || "—";
  }

  getPermissionSubtitle(permission: any): string {
    const resource = permission?.resource || "";
    const action = permission?.action || "";
    if (!resource && !action) {
      return "—";
    }
    return `${resource || "—"} · ${action || "—"}`;
  }
}
