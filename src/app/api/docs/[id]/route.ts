// src/app/api/docs/[id]/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { canEditPage, updatePage, deletePage } from "@/lib/docs/service";
import { query } from "@/lib/db";

function forbidden(status: 401) {
  return NextResponse.json({ error: "login required" }, { status });
}

function readOnly() {
  return NextResponse.json({ error: "read-only: hanya pembuat halaman (atau admin) yang bisa mengubah" }, { status: 403 });
}

async function pageAuthorId(id: string): Promise<string | null | undefined> {
  // undefined = page not found; null = page exists without an author
  const { rows } = await query("SELECT author_id FROM doc_pages WHERE id = $1", [id]);
  if (rows.length === 0) return undefined;
  return rows[0].author_id;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if ("status" in g) return forbidden(g.status);
  const { id } = await params;
  const authorId = await pageAuthorId(id);
  if (authorId === undefined) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canEditPage(authorId, g.session.user)) return readOnly();
  const body = await req.json();
  try {
    const updated = await updatePage(id, body, g.session.user.id);
    return NextResponse.json({ ok: true, slug: updated.slug });
  } catch (e) {
    const code = (e as { code?: string }).code;
    return NextResponse.json({ error: code ?? String(e) }, { status: code === "NOT_FOUND" ? 404 : code === "SLUG_TAKEN" ? 409 : 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if ("status" in g) return forbidden(g.status);
  const { id } = await params;
  const authorId = await pageAuthorId(id);
  if (authorId === undefined) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canEditPage(authorId, g.session.user)) return readOnly();
  try {
    await deletePage(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    return NextResponse.json({ error: code ?? String(e) }, { status: code === "HAS_CHILDREN" ? 409 : 400 });
  }
}
