export class Utils {

  public static encode5t(str: any): string {
    str = String(str);
    for (let i = 0; i < 5; i++) {
      str = btoa(str);
      str = str.split('').reverse().join('');
    }
    return str;
  }

 public static decode5t(str: string): string {
    if (!str) return "";

    for (let i = 0; i < 5; i++) {
      str = str.split("").reverse().join("");
      str = Buffer.from(str, "base64").toString("utf8");
    }

    return str;
  }
}
