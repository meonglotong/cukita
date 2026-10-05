// src/components/editor/heading-ids.ts
import { slugify } from "@/lib/md/slugify";

// Assign ids to editor headings so TOC anchor links + scroll-spy work.
// Mirrors the exact id scheme of the server-side renderer
// (src/lib/md/render.ts): slugify(text) with GitHub-style -2/-3 dedup,
// computed in document order over ALL h1/h2/h3 (the server counts every
// heading too, so sequences match even when an H1 is in the body).
export function assignHeadingIds(root: ParentNode): void {
  const counts = new Map<string, number>();
  for (const el of Array.from(root.querySelectorAll("h1, h2, h3"))) {
    const base = slugify(el.textContent ?? "") || "section";
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    el.id = n === 0 ? base : `${base}-${n + 1}`;
  }
}
