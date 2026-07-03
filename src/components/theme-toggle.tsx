"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setThemeAction } from "@/lib/actions";
import type { Theme } from "@/lib/theme";

// Icon button that flips light ↔ dark. Parent passes the server-known
// theme so first render matches SSR. Click writes the cookie via the
// server action, flips the <html> class immediately for zero-flicker
// feedback, then refreshes so any server-rendered branches also update.
export default function ThemeToggle({ theme }: { theme: Theme }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    // Optimistically flip the class so the UI reacts before the round-trip
    // completes. The server action + refresh keep future navigations
    // consistent.
    if (typeof document !== "undefined") {
      const html = document.documentElement;
      html.classList.remove(theme === "light" ? "theme-light" : "theme-dark");
      html.classList.add(next === "light" ? "theme-light" : "theme-dark");
    }
    startTransition(async () => {
      await setThemeAction(next);
      router.refresh();
    });
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-60"
    >
      {isDark ? (
        // Sun icon — visible in dark mode, click to go light
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v1.5" />
          <path d="M12 19.5V21" />
          <path d="M3 12h1.5" />
          <path d="M19.5 12H21" />
          <path d="M5.6 5.6l1.05 1.05" />
          <path d="M17.35 17.35l1.05 1.05" />
          <path d="M5.6 18.4l1.05-1.05" />
          <path d="M17.35 6.65l1.05-1.05" />
        </svg>
      ) : (
        // Moon icon — visible in light mode, click to go dark
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
