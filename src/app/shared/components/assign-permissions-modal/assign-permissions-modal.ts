import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { forkJoin, of, Observable } from "rxjs";

import { ApiService } from "../../../core/api.service";
import { UiService } from "../../../core/ui.service";

/**
 * AssignPermissionsModalComponent
 * ---------------------------------------------------------
 * Reusable "many-to-many" assignment dialog that lets an admin
 * assign / revoke permissions for a single role.
 *
 * Rows are now multi-select checkboxes. Nothing hits the network
 * until "Save changes" is pressed - at that point the diff between
 * what was originally assigned and what's currently checked is
 * sent as a single batched request per direction:
 *
 *   POST  /authorization/roles/:roleId/permissions                    { permissionIds: [...] }        (assign, batched)
 *   PATCH /authorization/roles/:roleId/permissions/:rolePermissionId  { status: 'INACTIVE' }           (revoke, one call per row, fired in parallel)
 *
 * NOTE: unlike AssignRolesModalComponent (which reuses your
 * existing /users/:userId/roles endpoints), the role<->permission
 * junction endpoints below do NOT exist yet on the backend.
 * They are designed to mirror the existing user<->role pattern
 * exactly. See role-permissions.backend-additions.js for the
 * matching service / controller / route code to add on the backend.
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
  saving = false;

  allPermissions: any[] = [];

  // permissionId -> rolePermissionId, for permissions ORIGINALLY assigned to the role.
  // This is our source of truth for computing the save diff.
  private assignedMap: Record<string, number | string> = {};

  // permissionIds currently checked in the UI. Seeded from assignedMap on load,
  // then mutated locally as the admin (un)checks rows. Nothing is sent to
  // the server until save() is called.
  private selectedIds = new Set<string>();

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
    this.selectedIds = new Set();
    this.visible = true;

    this.loadPermissions();
    this.loadAssignments();
  }

  close(): void {
    if (this.saving) {
      return;
    }
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
            const status = assignment?.status
          if (
            permissionId !== undefined &&
            permissionId !== null &&
            rolePermissionId !== undefined &&
            status === "ACTIVE"
          ) {
            map[String(permissionId)] = rolePermissionId;
          }
        });
        this.assignedMap = map;
        // Seed the checkbox selection with whatever is currently assigned.
        this.selectedIds = new Set(Object.keys(map));
      },
      error: (error) => {
        console.error("Failed to load assigned permissions:", error);
        this.ui.show("Failed to load assigned permissions");
      },
    });
  }

  // =========================================================
  // SELECTION (local only, no network calls)
  // =========================================================

  isSelected(permission: any): boolean {
    const permissionId = permission?.permission_id ?? permission?.permissionId;
    return permissionId !== undefined && this.selectedIds.has(String(permissionId));
  }

  private isOriginallyAssigned(permission: any): boolean {
    const permissionId = permission?.permission_id ?? permission?.permissionId;
    return (
      permissionId !== undefined &&
      this.assignedMap[String(permissionId)] !== undefined
    );
  }

  /** Visual state of a row relative to the original assignment, for highlighting. */
  rowState(permission: any): "added" | "removed" | "unchanged" {
    const selected = this.isSelected(permission);
    const wasAssigned = this.isOriginallyAssigned(permission);
    if (selected && !wasAssigned) {
      return "added";
    }
    if (!selected && wasAssigned) {
      return "removed";
    }
    return "unchanged";
  }

  toggleSelection(permission: any): void {
    if (this.saving) {
      return;
    }
    const permissionId = permission?.permission_id ?? permission?.permissionId;
    if (permissionId === undefined || permissionId === null) {
      return;
    }
    const key = String(permissionId);
    if (this.selectedIds.has(key)) {
      this.selectedIds.delete(key);
    } else {
      this.selectedIds.add(key);
    }
  }

  get hasChanges(): boolean {
    const originalKeys = Object.keys(this.assignedMap);
    if (originalKeys.length !== this.selectedIds.size) {
      return true;
    }
    return originalKeys.some((key) => !this.selectedIds.has(key));
  }

  get pendingAddCount(): number {
    let count = 0;
    this.selectedIds.forEach((id) => {
      if (this.assignedMap[id] === undefined) {
        count++;
      }
    });
    return count;
  }

  get pendingRemoveCount(): number {
    return Object.keys(this.assignedMap).filter((id) => !this.selectedIds.has(id)).length;
  }

  // =========================================================
  // SAVE (batched)
  // =========================================================

  save(): void {
    const roleId = this.getRoleId();
    if (!roleId || this.saving || !this.hasChanges) {
      return;
    }

    const toAssign: (number | string)[] = [];
    this.selectedIds.forEach((id) => {
      if (this.assignedMap[id] === undefined) {
        toAssign.push(id);
      }
    });

    const toRevokeRolePermissionIds: (number | string)[] = Object.keys(this.assignedMap)
      .filter((id) => !this.selectedIds.has(id))
      .map((id) => this.assignedMap[id]);

    this.saving = true;

    const requests: Observable<any>[] = [];

    if (toAssign.length) {
      // Single batched call - all newly-checked permissions assigned at once.
      try {
        requests.push(
          this.api.post<any>(`/authorization/roles/${roleId}/permissions`, {
            permissionIds: toAssign,
          }),
        );
      } catch(error) {
        console.log("Error: ", error);
      }
    }

    if (toRevokeRolePermissionIds.length) {
      // Single batched call - all newly-checked permissions assigned at once.
      try {
        requests.push(
          this.api.patch<any>(`/authorization/roles/${roleId}/permissions`, {
            permissionIds: toRevokeRolePermissionIds,
          }),
        );
      } catch(error) {
        console.log("Error: ", error);
      }
    }

    forkJoin(requests.length ? requests : [of(null)]).subscribe({
      next: () => {
        this.saving = false;
        this.ui.show(`Permissions updated for ${this.getRoleLabel()}`);
        this.close();
      },
      error: (error) => {
        this.saving = false;
        console.error("Failed to save permission assignments:", error);
        this.ui.show("Failed to save permission assignments");
        // Re-sync with the server so the checkboxes reflect what actually
        // stuck, in case only some of the batched requests failed.
        this.loadAssignments();
      },
    });
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
