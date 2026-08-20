import { Component } from "@angular/core";

export type NotificationType =
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "INFORMATION";

export type NotificationContentType =
  | "TEXT"
  | "JSON";

export interface NotificationModalConfig {
  type?: NotificationType;
  title?: string;
  message?: string;
  contentType?: NotificationContentType;
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

  open(config: NotificationModalConfig): void {

    this.type = config.type || "INFORMATION";

    this.title = config.title || this.getDefaultTitle(this.type);

    this.message = config.message || "";

    this.contentType =
      config.contentType || "TEXT";

    this.jsonHeaders = [];

    this.jsonRows = [];

    if (this.contentType === "JSON") {
      this.parseJson(this.message);
    }

    this.visible = true;
  }

  close(): void {
    this.visible = false;
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
          item =>
            item !== null &&
            typeof item === "object" &&
            !Array.isArray(item)
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
          Value: parsed
        }
      ];

    } catch (error) {

      console.error(
        "Invalid JSON notification content:",
        error
      );

      this.jsonHeaders = ["Error"];

      this.jsonRows = [
        {
          Error: "Unable to parse notification content as JSON."
        }
      ];
    }
  }

  private buildJsonHeaders(): void {

    const headers = new Set<string>();

    this.jsonRows.forEach(row => {

      Object.keys(row).forEach(key => {
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
}