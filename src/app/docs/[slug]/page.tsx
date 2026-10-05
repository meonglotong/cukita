// src/app/docs/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/docs/service";
import { renderMarkdown } from "@/lib/md/render";
import { Toc } from "@/components/Toc";
import { Markdown } from "@/components/Markdown";
import { HighlightClient } from "@/components/highlight-client";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();
  const { html, toc } = renderMarkdown(page.bodyMd ?? "");
  return (
    <div className="doc-layout">
      <article className="doc-article">
        <h1>{page.title}</h1>
        <Markdown html={html} />
        <HighlightClient />
      </article>
      <aside className="doc-toc-col">
        <Toc items={toc} />
      </aside>
    </div>
  );
}
