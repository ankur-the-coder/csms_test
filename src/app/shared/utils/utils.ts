export class Utils {

//   public static encode5t(str: any): string {
//     str = String(str);
//     for (let i = 0; i < 5; i++) {
//       str = btoa(str);
//       str = str.split('').reverse().join('');
//     }
//     return str;
//   }

//  public static decode5t(str: string): string {
//     if (!str) return "";

//     for (let i = 0; i < 5; i++) {
//       str = str.split("").reverse().join("");
//       str = Buffer.from(str, "base64").toString("utf8");
//     }

//     return str;
//   }
// }

public static encode5t(value: any): string {
  let str = String(value);

  for (let i = 0; i < 5; i++) {
    if (typeof Buffer !== "undefined") {
      str = Buffer.from(str, "utf8").toString("base64");
    } else {
      str = btoa(str);
    }

    str = str.split("").reverse().join("");
  }

  return str;
}

public static decode5t(value: any): string {
  if (!value) return "";

  let str = String(value);

  for (let i = 0; i < 5; i++) {
    str = str.split("").reverse().join("");

    if (typeof Buffer !== "undefined") {
      str = Buffer.from(str, "base64").toString("utf8");
    } else {
      str = atob(str);
    }
  }

  return str;
}

  /**
   * Normalizes timestamps from backend (which are in UTC but often returned without timezone marker)
   * into a proper UTC ISO string (ending with 'Z') so that the browser and Angular DatePipe
   * automatically convert them into the user's country/local time.
   */
  public static ensureUtcIso(value: any): string {
    if (!value) return '';
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? '' : value.toISOString();
    }
    const raw = String(value).trim();
    if (!raw) return '';

    // Remove any trailing microseconds beyond 3 digits if present (e.g. .123456 -> .123)
    let str = raw.replace(' ', 'T');

    // If it already has Z or an explicit timezone offset like +05:30, -04:00, +00:00
    if (/Z$|[+-]\d{2}(:?\d{2})?$/.test(str)) {
      return str;
    }

    // Append 'Z' to treat as UTC
    return `${str}Z`;
  }
}
