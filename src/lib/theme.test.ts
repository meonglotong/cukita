// @vitest-environment happy-dom
// src/lib/theme.test.ts
import { it, expect } from "vitest";
import { resolveInitialTheme, applyTheme } from "./theme";

it("stored choice wins over system preference", () => {
  expect(resolveInitialTheme("dark", "light")).toBe("dark");
  expect(resolveInitialTheme("light", "dark")).toBe("light");
});

it("falls back to system preference when nothing stored", () => {
  expect(resolveInitialTheme(null, "dark")).toBe("dark");
  expect(resolveInitialTheme(null, "light")).toBe("light");
  expect(resolveInitialTheme("", "dark")).toBe("dark");
});

it("treats garbage stored values as unset", () => {
  expect(resolveInitialTheme("neon", "dark")).toBe("dark");
});

it("applyTheme sets the html data-theme and persists it", () => {
  delete (document.documentElement.dataset as Record<string, string>)["theme"];
  applyTheme("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("cukita-theme")).toBe("dark");
  applyTheme("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem("cukita-theme")).toBe("light");
});
