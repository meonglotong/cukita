// src/app/docs/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageBySlug, listPages } from "@/lib/docs/service";
import { renderMarkdown } from "@/lib/md/render";
import { Toc } from "@/components/Toc";
import { Markdown } from "@/components/Markdown";
import { HighlightClient } from "@/components/highlight-client";
import { PageActions } from "@/components/PageActions";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();
  const { html, toc } = renderMarkdown(page.bodyMd ?? "");
  const flat = (await listPages()).map((p) => ({ id: p.id, title: p.title }));
  return (
    <div className="doc-layout">
      <article className="doc-article">
        <div className="doc-header">
          <h1>{page.title}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn btn-primary" href={`/docs/${slug}/edit`}>Edit</Link>
            <PageActions pageId={page.id} pageTitle={page.title} parentId={page.parentId} flat={flat} />
          </div>
        </div>
        <Markdown html={html} />
        <HighlightClient />
      </article>
      <aside className="doc-toc-col">
        <Toc items={toc} />
      </aside>
    </div>
  );
}
