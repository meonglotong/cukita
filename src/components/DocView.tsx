// src/components/DocView.tsx
// Read-only rendering of a page for users who are not the author (and not
// admin). The markdown was sanitized server-side in renderMarkdown, so the
// html is safe to inject.
import { Markdown } from "./Markdown";

export function DocView({ title, html, authorName }: { title: string; html: string; authorName: string | null }) {
  return (
    <div className="doc-view">
      <h1 className="doc-title-readonly">{title}</h1>
      <p className="read-only-note">
        Halaman ini cuma bisa diedit oleh <strong>{authorName ?? "admin"}</strong>.
      </p>
      <Markdown html={html} />
    </div>
  );
}
