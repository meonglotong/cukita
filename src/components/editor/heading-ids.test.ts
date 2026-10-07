// @vitest-environment happy-dom
// src/components/editor/heading-ids.test.ts
import { it, expect } from "vitest";
import { resolveHeading } from "./heading-ids";

function withHtml(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

it("resolves by matching heading text", () => {
  const root = withHtml("<h2>Cara Menulis</h2><h3>Struktur</h3>");
  expect(resolveHeading(root, "struktur", "Struktur")?.tagName).toBe("H3");
  expect(resolveHeading(root, "cara-menulis", "Cara Menulis")?.tagName).toBe("H2");
});

it("prefers a live element with the given id", () => {
  const root = withHtml('<h2 id="cara-menulis">Cara Menulis</h2><h2>Cara Menulis</h2>');
  expect(resolveHeading(root, "cara-menulis", "Cara Menulis")?.id).toBe("cara-menulis");
});

it("ignores ids pointing outside the editor root", () => {
  const outside = document.createElement("h2");
  outside.id = "cara-menulis";
  outside.textContent = "Luar";
  document.body.appendChild(outside);
  const root = withHtml("<h2>Cara Menulis</h2>");
  expect(resolveHeading(root, "cara-menulis", "Cara Menulis")?.id).toBe("");
});

it("matches TOC text carrying markdown emphasis against a clean heading", () => {
  const root = withHtml("<h2>Update System Package</h2>");
  expect(resolveHeading(root, "update-system-package", "**Update System Package**")?.tagName).toBe("H2");
});

it("returns null when no heading matches", () => {
  const root = withHtml("<p>bukan heading</p>");
  expect(resolveHeading(root, "x", "Tidak Ada")).toBeNull();
});
