// src/scripts/make-user.ts
import { query, closePool } from "../lib/db";
import { hashPassword } from "../lib/password";

export async function createUser(input: { email: string; name: string; password: string; role: "admin" | "user" }): Promise<{ ok: boolean; error?: string }> {
  const hash = await hashPassword(input.password);
  try {
    const { rows } = await query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id`,
      [input.email, input.name, hash, input.role]
    );
    return { ok: true };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { ok: false, error: "email already exists" };
    throw e;
  }
}

// CLI: tsx src/scripts/make-user.ts <email> <name> <password> [role]
if (process.argv[1].includes("make-user")) {
  const [email, name, password, role = "user"] = process.argv.slice(2);
  createUser({ email, name, password, role: role as "admin" | "user" })
    .then(({ ok, error }) => { console.log(ok ? "user created" : error); return closePool(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
