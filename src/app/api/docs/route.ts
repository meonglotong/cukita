// src/app/api/docs/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { listPages, createPage } from "@/lib/docs/service";
import { slugify } from "@/lib/md/slugify";

function forbidden(status: 401) {
  return NextResponse.json({ error: "login required" }, { status });
}

export async function GET() {
  const g = await requireAuth();
  if ("status" in g) return forbidden(g.status);
  return NextResponse.json(await listPages());
}

export async function POST(req: Request) {
  const g = await requireAuth();
  if ("status" in g) return forbidden(g.status);
  const body = await req.json();
  const id = await createPage({
    title: String(body.title),
    slug: body.slug ? slugify(String(body.slug)) : slugify(String(body.title)),
    isSection: Boolean(body.isSection),
    bodyMd: body.bodyMd == null ? null : String(body.bodyMd),
    parentId: body.parentId ?? null,
    position: Number(body.position ?? 0),
  }, g.session.user.id);
  return NextResponse.json({ id }, { status: 201 });
}
