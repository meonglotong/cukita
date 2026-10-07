// src/app/api/admin/users/[id]/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { hashPassword } from "@/lib/password";
import { query } from "@/lib/db";

const ROLES = ["superadmin", "admin", "user"];

async function superadminCount(): Promise<number> {
  const { rows } = await query("SELECT count(*)::int AS n FROM users WHERE role = 'superadmin'");
  return rows[0].n;
}

async function fetchRole(id: string): Promise<string | null> {
  const { rows } = await query("SELECT role FROM users WHERE id = $1", [id]);
  return rows[0]?.role ?? null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Only the superadmin manages other users (role, active, password).
  const g = await requireAuth();
  if ("status" in g) return NextResponse.json({ error: "login required" }, { status: g.status });
  if (g.session.user.role !== "superadmin") {
    return NextResponse.json({ error: "hanya superadmin yang bisa mengubah user lain" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  if (body.password && String(body.password).length < 8) return NextResponse.json({ error: "password min 8 char" }, { status: 400 });
  if (body.role && !ROLES.includes(body.role)) return NextResponse.json({ error: "role harus superadmin|admin|user" }, { status: 400 });

  const nSuper = await superadminCount();
  const isLastSuper = nSuper === 1 && (await fetchRole(id)) === "superadmin";
  // Exactly one superadmin, always: no second promotion, and the last one
  // cannot demote/deactivate themselves (the app would lose its god).
  if (body.role === "superadmin" && id !== g.session.user.id && nSuper >= 1) {
    return NextResponse.json({ error: "sudah ada superadmin — demote dulu yang lama" }, { status: 409 });
  }
  if (isLastSuper && ((body.role && body.role !== "superadmin") || body.active === false)) {
    return NextResponse.json({ error: "superadmin terakhir tidak boleh demote/nonaktifkan diri sendiri" }, { status: 409 });
  }

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
