// src/app/docs/[slug]/page.tsx
// The page is the editor when the viewer may edit it (author or admin);
// everyone else gets a read-only rendered view (CUKITA: cuma yang bikin
// yang boleh ngedit).
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPageBySlug, listPages, canEditPage } from "@/lib/docs/service";
import { renderMarkdown } from "@/lib/md/render";
import { Toc } from "@/components/Toc";
import { DocEditor } from "@/components/DocEditor";
import { DocView } from "@/components/DocView";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();
  // TOC reflects the last saved content; it updates on the next page load
  const { html, toc } = renderMarkdown(page.bodyMd ?? "");
  const session = await auth();
  const canEdit = canEditPage(page.authorId, { id: session?.user?.id ?? "", role: session?.user?.role ?? "user" });
  const parents = canEdit ? (await listPages()).filter((p) => p.id !== page.id) : [];
  return (
    <div className="doc-layout">
      <article className="doc-article">
        {canEdit ? (
          <DocEditor
            pageId={page.id}
            initialTitle={page.title}
            initialBody={page.bodyMd ?? ""}
            initialParentId={page.parentId}
            parents={parents.map((p) => ({ id: p.id, title: p.title }))}
          />
        ) : (
          <DocView title={page.title} html={html} authorName={page.authorName} />
        )}
      </article>
      <aside className="doc-toc-col">
        <Toc items={toc} />
      </aside>
    </div>
  );
}
