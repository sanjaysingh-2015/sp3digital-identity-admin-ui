import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { ApiService } from "../../../core/api.service";
import { UiService } from "../../../core/ui.service";

/**
 * AssignRolesModalComponent
 * ---------------------------------------------------------
 * Reusable "many-to-many" assignment dialog that lets an admin
 * assign / revoke roles for a single user.
 *
 * Wired against the EXISTING backend endpoints already present
 * in userService.js / userController.js:
 *
 *   GET   /users/:userId/roles                (effective assignments)
 *   POST  /users/:userId/roles                { roleId }
 *   PATCH /users/:userId/roles/:userRoleId    { status: 'INACTIVE' }
 *
 * Usage (from a parent component):
 *
 *   <app-assign-roles-modal #assignRolesModal></app-assign-roles-modal>
 *
 *   @ViewChild('assignRolesModal') assignRolesModal!: AssignRolesModalComponent;
 *   openAssignRoles(user) { this.assignRolesModal.open(user); }
 */
@Component({
  selector: "app-assign-roles-modal",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./assign-roles-modal.html",
  styleUrls: ["./assign-roles-modal.css"],
})
export class AssignRolesModalComponent {
  visible = false;

  user: any = null;

  search = "";

  loading = false;
  private busyRoleId: number | string | null = null;

  allRoles: any[] = [];

  // roleId -> userRoleId, for roles currently (effectively) assigned to the user
  private assignedMap: Record<string, number | string> = {};

  constructor(
    private api: ApiService,
    private ui: UiService,
  ) {}

  // =========================================================
  // OPEN / CLOSE
  // =========================================================

  open(user: any): void {
    const userId = user?.user_id || user?.userId;

    if (!userId) {
      this.ui.show("Invalid user ID");
      return;
    }

    this.user = user;
    this.search = "";
    this.assignedMap = {};
    this.visible = true;

    this.loadRoles();
    this.loadAssignments();
  }

  close(): void {
    this.visible = false;
    this.user = null;
  }

  // =========================================================
  // DATA LOADING
  // =========================================================

  private loadRoles(): void {
    this.loading = true;

    this.api.get<any>("/authorization/roles", { page: 1, limit: 200 }).subscribe({
      next: (response) => {
        const rows =
          response?.data?.items ||
          response?.items ||
          response?.data ||
          response?.rows ||
          [];

        this.allRoles = rows.filter((role: any) => (role?.status || "ACTIVE") === "ACTIVE");
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error("Failed to load roles:", error);
        this.ui.show("Failed to load roles");
      },
    });
  }

  private loadAssignments(): void {
    const userId = this.getUserId();
    if (!userId) {
      return;
    }

    this.api.get<any>(`/users/${userId}/roles`).subscribe({
      next: (response) => {
        const items = response?.items || response?.data?.items || response?.data || [];

        const map: Record<string, number | string> = {};
        items.forEach((assignment: any) => {
          const roleId = assignment?.roleId ?? assignment?.role_id;
          const userRoleId = assignment?.userRoleId ?? assignment?.user_role_id;
          if (roleId !== undefined && roleId !== null && userRoleId !== undefined) {
            map[String(roleId)] = userRoleId;
          }
        });
        this.assignedMap = map;
      },
      error: (error) => {
        console.error("Failed to load assigned roles:", error);
        this.ui.show("Failed to load assigned roles");
      },
    });
  }

  // =========================================================
  // TOGGLE ASSIGN / REVOKE
  // =========================================================

  isAssigned(role: any): boolean {
    const roleId = role?.role_id ?? role?.roleId;
    return roleId !== undefined && this.assignedMap[String(roleId)] !== undefined;
  }

  isBusy(role: any): boolean {
    const roleId = role?.role_id ?? role?.roleId;
    return this.busyRoleId !== null && String(this.busyRoleId) === String(roleId);
  }

  toggle(role: any): void {
    const userId = this.getUserId();
    const roleId = role?.role_id ?? role?.roleId;

    if (!userId || roleId === undefined || roleId === null) {
      this.ui.show("Invalid role selection");
      return;
    }

    if (this.busyRoleId !== null) {
      return;
    }

    this.busyRoleId = roleId;

    const userRoleId = this.assignedMap[String(roleId)];

    if (userRoleId !== undefined) {
      // ===================== REVOKE =====================
      this.api
        .patch<any>(`/users/${userId}/roles/${userRoleId}`, { status: "INACTIVE" })
        .subscribe({
          next: () => {
            delete this.assignedMap[String(roleId)];
            this.busyRoleId = null;
            this.ui.show(`Removed "${this.getRoleName(role)}" from ${this.getUserLabel()}`);
          },
          error: (error) => {
            this.busyRoleId = null;
            console.error("Failed to revoke role:", error);
            this.ui.show("Failed to remove role");
          },
        });
    } else {
      // ===================== ASSIGN =====================
      this.api.post<any>(`/users/${userId}/roles`, { roleId }).subscribe({
        next: (response) => {
          const newUserRoleId =
            response?.userRoleId ?? response?.data?.userRoleId ?? response?.user_role_id;
          this.assignedMap[String(roleId)] = newUserRoleId ?? true;
          this.busyRoleId = null;
          this.ui.show(`Assigned "${this.getRoleName(role)}" to ${this.getUserLabel()}`);
        },
        error: (error) => {
          this.busyRoleId = null;
          console.error("Failed to assign role:", error);
          this.ui.show("Failed to assign role");
        },
      });
    }
  }

  // =========================================================
  // FILTERING
  // =========================================================

  get filteredRoles(): any[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.allRoles;
    }
    return this.allRoles.filter((role) => {
      const name = (role?.role_name || role?.roleName || "").toLowerCase();
      const type = (role?.role_type || role?.roleType || "").toLowerCase();
      return name.includes(term) || type.includes(term);
    });
  }

  // =========================================================
  // HELPERS
  // =========================================================

  private getUserId(): number | string | null {
    return this.user?.user_id || this.user?.userId || null;
  }

  getUserLabel(): string {
    if (!this.user) {
      return "user";
    }
    const displayName = this.user?.display_name || this.user?.displayName;
    const first = this.user?.first_name || this.user?.firstName || "";
    const last = this.user?.last_name || this.user?.lastName || "";
    const fullName = `${first} ${last}`.trim();
    return displayName || fullName || this.user?.username || "this user";
  }

  getRoleName(role: any): string {
    return role?.role_name || role?.roleName || "—";
  }

  formatRoleType(roleType: string | null | undefined): string {
    if (!roleType) {
      return "—";
    }
    return roleType
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
