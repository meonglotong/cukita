// src/app/api/admin/users/[id]/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { hashPassword } from "@/lib/password";
import { query } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("status" in g) return NextResponse.json({ error: "forbidden" }, { status: g.status });
  const { id } = await params;
  const body = await req.json();
  if (body.password && String(body.password).length < 8) return NextResponse.json({ error: "password min 8 char" }, { status: 400 });
  if (body.role && body.role !== "admin" && body.role !== "user") return NextResponse.json({ error: "role must be admin|user" }, { status: 400 });
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { sets.push(`${col} = $${vals.length + 1}`); vals.push(v); };
  if (body.name) set("name", String(body.name));
  if (body.role) set("role", String(body.role));
  if (typeof body.active === "boolean") set("active", body.active);
  if (body.password) set("password_hash", await hashPassword(String(body.password)));
  if (sets.length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  vals.push(id);
  const { rowCount } = await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
  return rowCount === 0 ? NextResponse.json({ error: "not found" }, { status: 404 }) : NextResponse.json({ ok: true });
}
