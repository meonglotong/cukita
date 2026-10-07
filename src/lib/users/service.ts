// src/lib/users/service.ts
import { query } from "../db";
import { hashPassword, verifyPassword } from "../password";

// Self-service password change: the current password must verify, the new
// one must be at least 8 chars. Throws coded errors the route maps to 401/400.
export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [userId]);
  if (!rows[0]) throw Object.assign(new Error("not found"), { code: "NOT_FOUND" });
  const ok = await verifyPassword(rows[0].password_hash, current);
  if (!ok) throw Object.assign(new Error("wrong password"), { code: "WRONG_PASSWORD" });
  if (next.length < 8) throw Object.assign(new Error("password min 8 char"), { code: "TOO_SHORT" });
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, await hashPassword(next)]);
}
