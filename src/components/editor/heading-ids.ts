// src/components/editor/heading-ids.ts
// Resolve a TOC item to a live heading element inside the editor.
//
// ProseMirror normalizes the DOM to its schema on every transaction, so an
// id attribute set on a heading is not durable — text matching is the
// reliable path (heading text is stable between edits and unique enough
// within a page). `id` is kept as a fast path for any future durable
// source of ids (e.g. a heading extension attr).
export function resolveHeading(root: ParentNode, id: string, text: string): HTMLElement | null {
  const byId = document.getElementById(id);
  if (byId && root.contains(byId)) return byId;
  const trimmed = text.trim();
  const byText = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3")).find(
    (h) => h.textContent?.trim() === trimmed,
  );
  return byText ?? null;
}
