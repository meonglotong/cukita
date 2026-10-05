// src/app/docs/[slug]/edit/page.tsx
import { notFound } from "next/navigation";
import { getPageBySlug, listPages } from "@/lib/docs/service";
import { DocEditor } from "@/components/DocEditor";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();
  const parents = (await listPages()).filter((p) => p.id !== page.id);
  return (
    <DocEditor
      pageId={page.id}
      initialTitle={page.title}
      initialBody={page.bodyMd ?? ""}
      initialParentId={page.parentId}
      parents={parents.map((p) => ({ id: p.id, title: p.title }))}
    />
  );
}
