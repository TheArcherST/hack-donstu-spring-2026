export type AppPage = "game" | "admin";

export function resolveAppPage(pathname: string): AppPage {
  return pathname.startsWith("/admin") ? "admin" : "game";
}
