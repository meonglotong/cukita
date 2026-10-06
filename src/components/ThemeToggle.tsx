// src/components/ThemeToggle.tsx
"use client";
import { useEffect, useState } from "react";
import { currentTheme, toggleTheme, type Theme } from "@/lib/theme";

// Light/dark switch for CUKITA. The pre-paint script in layout.tsx has
// already applied the stored/system theme to the document before this
// renders, so there is no flash; the button mirrors and flips it.
//
// The initial state is `null` (not the resolved theme) so server and client
// first render are identical — reading the real preference happens in a
// post-mount effect, which is what keeps hydration clean.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

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
