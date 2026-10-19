// src/components/ThemeToggle.tsx
"use client";
import { useEffect, useState } from "react";
import { currentTheme, toggleTheme, type Theme } from "@/lib/theme";

// Light/dark switch for Gnosis — line-icon tipis (stroke 1.8, currentColor)
// biar clean di kedua tema, bukan emoji.
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="6.7" y2="6.7" />
      <line x1="17.3" y1="17.3" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="6.7" y2="17.3" />
      <line x1="17.3" y1="6.7" x2="19.1" y2="4.9" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// Light/dark switch for Gnosis. The pre-paint script in layout.tsx has
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
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
