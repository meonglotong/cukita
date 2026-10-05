// src/app/api/docs/[id]/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { updatePage, deletePage } from "@/lib/docs/service";

function forbidden(status: 401) {
  return NextResponse.json({ error: "login required" }, { status });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if ("status" in g) return forbidden(g.status);
  const { id } = await params;
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
  try {
    await deletePage(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    return NextResponse.json({ error: code ?? String(e) }, { status: code === "HAS_CHILDREN" ? 409 : 400 });
  }
}
