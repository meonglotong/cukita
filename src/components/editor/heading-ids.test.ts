// @vitest-environment happy-dom
// src/components/editor/heading-ids.test.ts
import { it, expect } from "vitest";
import { assignHeadingIds } from "./heading-ids";

function withHtml(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

it("assigns slugified ids to headings", () => {
  const root = withHtml("<h2>Cara Menulis</h2><p>x</p><h3>Struktur Tim</h3>");
  assignHeadingIds(root);
  expect(root.querySelector("h2")?.id).toBe("cara-menulis");
  expect(root.querySelector("h3")?.id).toBe("struktur-tim");
});

it("dedups repeated headings with -2, -3 suffixes", () => {
  const root = withHtml("<h2>Backup</h2><h2>Backup</h2><h2>Backup</h2>");
  assignHeadingIds(root);
  const ids = [...root.querySelectorAll("h2")].map((h) => h.id);
  expect(ids).toEqual(["backup", "backup-2", "backup-3"]);
});

it("counts H1s in the dedup sequence like the server renderer", () => {
  const root = withHtml("<h1>Backup</h1><h2>Backup</h2>");
  assignHeadingIds(root);
  expect(root.querySelector("h1")?.id).toBe("backup");
  expect(root.querySelector("h2")?.id).toBe("backup-2");
});

it("reassigns ids when heading text changes", () => {
  const root = withHtml("<h2>Depan</h2>");
  assignHeadingIds(root);
  root.querySelector("h2")!.textContent = "Belakang";
  assignHeadingIds(root);
  expect(root.querySelector("h2")?.id).toBe("belakang");
});

it("leaves non-heading elements without ids", () => {
  const root = withHtml("<p>halo</p><h2>Judul</h2><div>isi</div>");
  assignHeadingIds(root);
  expect(root.querySelector("p")?.id).toBe("");
  expect(root.querySelector("div")?.id).toBe("");
});
