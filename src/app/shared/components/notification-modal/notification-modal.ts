import { Component } from "@angular/core";

export type NotificationType = "SUCCESS" | "WARNING" | "ERROR" | "INFORMATION";

export type NotificationContentType = "TEXT" | "JSON";

export interface NotificationModalConfig {
  type?: NotificationType;
  title?: string;
  message?: string;
  contentType?: NotificationContentType;
  autoCloseAfter?: number;
}

@Component({
  selector: "app-notification-modal",
  standalone: true,
  templateUrl: "./notification-modal.html",
  styleUrls: ["./notification-modal.css"],
})
export class NotificationModalComponent {
  visible = false;
  type: NotificationType = "INFORMATION";
  title = "Information";
  message = "";
  contentType: NotificationContentType = "TEXT";
  jsonHeaders: string[] = [];
  jsonRows: Record<string, any>[] = [];
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  open(config: NotificationModalConfig): void {
    this.clearAutoCloseTimer();
    this.type = config.type || "INFORMATION";
    this.title = config.title || this.getDefaultTitle(this.type);
    this.message = config.message || "";
    this.contentType = config.contentType || "TEXT";
    this.jsonHeaders = [];
    this.jsonRows = [];

    if (this.type === "ERROR") {
      this.message = this.formatErrorMessage(this.message);
    }

    if (this.contentType === "JSON") {
      this.parseJson(this.message);
    }
    this.visible = true;

    // Setup automatic close
    if (config.autoCloseAfter !== undefined && config.autoCloseAfter > 0) {
      this.autoCloseTimer = setTimeout(() => {
        this.close();
      }, config.autoCloseAfter);
    }
  }

  close(): void {
    this.clearAutoCloseTimer();
    this.visible = false;
  }

  private clearAutoCloseTimer(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }

  getDefaultTitle(type: NotificationType): string {
    switch (type) {
      case "SUCCESS":
        return "Success";
      case "WARNING":
        return "Warning";
      case "ERROR":
        return "Error";
      case "INFORMATION":
      default:
        return "Information";
    }
  }

  parseJson(json: string): void {
    try {
      const parsed = JSON.parse(json);
      /*
       * Case 1:
       * JSON object
       *
       * {
       *   "name": "Sanjay",
       *   "role": "Admin",
       *   "status": "ACTIVE"
       * }
       */

      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        this.jsonHeaders = Object.keys(parsed);
        this.jsonRows = [parsed];
        return;
      }

      /*
       * Case 2:
       * JSON array
       *
       * [
       *   {
       *     "id": 1,
       *     "name": "John",
       *     "status": "ACTIVE"
       *   },
       *   {
       *     "id": 2,
       *     "name": "Mary",
       *     "status": "ACTIVE"
       *   }
       * ]
       */

      if (Array.isArray(parsed)) {
        this.jsonRows = parsed.filter(
          (item) =>
            item !== null && typeof item === "object" && !Array.isArray(item),
        );
        this.buildJsonHeaders();
        return;
      }

      /*
       * Primitive JSON
       *
       * "Success"
       * 123
       * true
       */

      this.jsonHeaders = ["Value"];
      this.jsonRows = [
        {
          Value: parsed,
        },
      ];
    } catch (error) {
      console.error("Invalid JSON notification content:", error);
      this.jsonHeaders = ["Error"];
      this.jsonRows = [
        {
          Error: "Unable to parse notification content as JSON.",
        },
      ];
    }
  }

  private buildJsonHeaders(): void {
    const headers = new Set<string>();
    this.jsonRows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        headers.add(key);
      });
    });
    this.jsonHeaders = Array.from(headers);
  }

  formatJsonValue(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  formatErrorMessage(error: any): string {
    const apiError = error?.error?.error;

    if (!apiError) {
      return (
        error?.error?.message ||
        error?.message ||
        "An unexpected error occurred."
      );
    }

    const lines: string[] = [];
    if (apiError.code) {
      lines.push(`<span class="notification-errcode">Error Code: ${this.formatErrorCode(apiError.code)}</span>`);
    }

    if (apiError.message) {
      lines.push(`<strong>Message:</strong> ${apiError.message}`);
    }

    if (Array.isArray(apiError.details) && apiError.details.length) {
      lines.push(`<strong>Details:</strong>`);

      apiError.details.forEach((detail: string) => {
        lines.push(
          `<span class="notification-detail">${this.formatValidationDetail(detail)}</span>`,
        );
      });
    }

    return lines.join("\n");
  }

  formatValidationDetail(detail: string): string {
    if (!detail) {
      return detail;
    }

    const match = detail.match(/^"?\\?"?([^"\\]+)"?\\?"?\s+(.*)$/);

    if (!match) {
      return detail;
    }

    const fieldName = match[1];
    const message = match[2];

    const formattedFieldName = fieldName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    return `<strong>${formattedFieldName}:</strong> ${message}`;
  }

  formatErrorCode(errorCode: string): string {
  if (!errorCode) {
    return "";
  }

  return errorCode
    .toLowerCase()
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
}
