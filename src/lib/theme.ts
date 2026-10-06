// src/lib/theme.ts
// Light/dark theme, CUKITA. Stored choice wins; system preference is the
// fallback. The pre-paint script in layout.tsx uses the same resolution so
// there is no flash of the wrong theme.
export type Theme = "light" | "dark";

const STORAGE_KEY = "cukita-theme";

export function resolveInitialTheme(stored: string | null, system: Theme): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return system;
}

export function storedTheme(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// SSR-safe: on the server there is no user preference yet; the pre-paint
// script in layout.tsx settles the real value before first paint.
export function currentTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return resolveInitialTheme(storedTheme(), systemTheme());
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
