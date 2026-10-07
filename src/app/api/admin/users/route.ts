// src/app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { createUser } from "@/scripts/make-user";
import { query } from "@/lib/db";

export async function GET(_req: Request) {
  const g = await requireAdmin();
  if ("status" in g) return NextResponse.json({ error: "forbidden" }, { status: g.status });
  const { rows } = await query(
    `SELECT id, email, name, role, active, created_at AS "createdAt" FROM users ORDER BY created_at`);
  return NextResponse.json({ users: rows });
}

export async function POST(req: Request) {
  const g = await requireAdmin();
  if ("status" in g) return NextResponse.json({ error: "forbidden" }, { status: g.status });
  const body = await req.json();
  if (typeof body.email !== "string" || typeof body.name !== "string" || typeof body.password !== "string" || body.password.length < 8) {
    return NextResponse.json({ error: "email, name, password (min 8 char) required" }, { status: 400 });
  }
  // Admins may create users and admins; only the superadmin may create a
  // superadmin (PATCH enforces the one-superadmin cap, this one the menu).
  const allowedRoles = g.session.user.role === "superadmin" ? ["superadmin", "admin", "user"] : ["admin", "user"];
  if (body.role && !allowedRoles.includes(body.role)) {
    return NextResponse.json({ error: `role must be one of: ${allowedRoles.join("|")}` }, { status: 400 });
  }
  const { ok, error } = await createUser({ email: body.email, name: body.name, password: body.password, role: body.role });
  return ok ? NextResponse.json({ ok: true }, { status: 201 }) : NextResponse.json({ error }, { status: 409 });
}
