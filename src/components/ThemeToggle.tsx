// src/components/ThemeToggle.tsx
"use client";
import { useState } from "react";
import { currentTheme, toggleTheme, type Theme } from "@/lib/theme";

// Light/dark switch for CUKITA. The pre-paint script in layout.tsx has
// already applied the stored/system theme before this renders, so there is
// no flash; the button just mirrors and flips it.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      title={dark ? "Ganti ke light mode" : "Ganti ke dark mode"}
      aria-label={dark ? "Ganti ke light mode" : "Ganti ke dark mode"}
      onClick={() => setTheme(toggleTheme())}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
