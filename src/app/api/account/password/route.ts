// src/app/api/account/password/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { changePassword } from "@/lib/users/service";

export async function POST(req: Request) {
  const g = await requireAuth();
  if ("status" in g) return NextResponse.json({ error: "login required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  if (!current || !next) return NextResponse.json({ error: "current dan password baru wajib diisi" }, { status: 400 });
  try {
    await changePassword(g.session.user.id, current, next);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    return NextResponse.json({ error: code ?? String(e) }, { status: code === "WRONG_PASSWORD" ? 401 : 400 });
  }
}
