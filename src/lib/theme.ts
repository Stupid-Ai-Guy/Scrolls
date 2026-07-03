import { cookies } from "next/headers";

export type Theme = "light" | "dark";

const THEME_COOKIE = "scrolls-theme";

// Reads the current theme from the request cookies. Defaults to dark so
// first-time visitors see the app in its native palette.
export async function getTheme(): Promise<Theme> {
  const jar = await cookies();
  const raw = jar.get(THEME_COOKIE)?.value;
  return raw === "light" ? "light" : "dark";
}
