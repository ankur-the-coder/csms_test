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
}
