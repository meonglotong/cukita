// src/components/ThemeSync.tsx
"use client";
import { useEffect } from "react";
import { applyTheme, currentTheme } from "@/lib/theme";

// React hydration of <html> drops the data-theme attribute set by the
// pre-paint script; this re-applies the resolved theme right after mount so
// the dark theme survives hydration.
export function ThemeSync() {
  useEffect(() => {
    applyTheme(currentTheme());
  }, []);
  return null;
}
