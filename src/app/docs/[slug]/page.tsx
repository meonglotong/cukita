// src/app/docs/[slug]/page.tsx
// The page itself is the editor (Notion-style) — no separate edit route.
import { notFound } from "next/navigation";
import { getPageBySlug, listPages } from "@/lib/docs/service";
import { renderMarkdown } from "@/lib/md/render";
import { Toc } from "@/components/Toc";
import { DocEditor } from "@/components/DocEditor";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();
  // TOC reflects the last saved content; it updates on the next page load
  const { toc } = renderMarkdown(page.bodyMd ?? "");
  const parents = (await listPages()).filter((p) => p.id !== page.id);
  return (
    <div className="doc-layout">
      <article className="doc-article">
        <DocEditor
          pageId={page.id}
          initialTitle={page.title}
          initialBody={page.bodyMd ?? ""}
          initialParentId={page.parentId}
          parents={parents.map((p) => ({ id: p.id, title: p.title }))}
        />
      </article>
      <aside className="doc-toc-col">
        <Toc items={toc} />
      </aside>
    </div>
  );
}
