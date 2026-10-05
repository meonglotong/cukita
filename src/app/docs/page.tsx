// src/app/docs/page.tsx
import { redirect } from "next/navigation";
import { listPages } from "@/lib/docs/service";

export const dynamic = "force-dynamic";

export default async function DocsHome() {
  const pages = (await listPages()).filter((p) => !p.isSection && p.slug);
  if (pages.length === 0) {
    return <p>Belum ada dokumentasi. Admin: tambah halaman di <code>/admin/docs</code>.</p>;
  }
  redirect(`/docs/${pages[0].slug}`);
}
