// src/app/docs/[slug]/edit/page.tsx
// Legacy: the page itself is the editor now — redirect old bookmarks.
import { notFound, redirect } from "next/navigation";
import { getPageBySlug } from "@/lib/docs/service";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();
  redirect(`/docs/${slug}`);
}
