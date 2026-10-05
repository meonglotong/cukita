// src/scripts/seed-admin.ts
// Idempotent: upserts the admin by email (existing row gets a fresh
// password hash and is re-activated; missing row is created).
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm seed:admin
import { query, closePool } from "../lib/db";
import { hashPassword } from "../lib/password";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD env vars are required");
    process.exit(1);
  }
  const name = process.env.ADMIN_NAME || "Admin";
  const hash = await hashPassword(password);
  const existing = (await query("SELECT id FROM users WHERE email = $1", [email])).rows[0];
  if (existing) {
    await query("UPDATE users SET password_hash = $2, active = true WHERE id = $1", [existing.id, hash]);
    console.log("admin password updated");
  } else {
    await query("INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,'admin')", [email, name, hash]);
    console.log("admin created");
  }
  await closePool();
}
main().catch((e) => { console.error(e); process.exit(1); });
