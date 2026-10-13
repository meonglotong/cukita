// src/lib/auth/oauth.test.ts
import { beforeAll, it, expect } from "vitest";
import { runMigrations } from "../../scripts/migrate";
import { query } from "../db";
import { resolveOrProvisionOauthUser } from "./oauth";

const MAIL = "oauth@test.local";

beforeAll(async () => {
  await runMigrations();
  await query("DELETE FROM users WHERE email = $1", [MAIL]);
});

it("provisions an unknown email as an active role user (no password)", async () => {
  const user = await resolveOrProvisionOauthUser({ email: MAIL, name: "Oauth Person" });
  expect(user).toMatchObject({ email: MAIL, name: "Oauth Person", role: "user" });
  const { rows } = await query("SELECT password_hash, active FROM users WHERE email = $1", [MAIL]);
  expect(rows[0].password_hash).toBeNull();
  expect(rows[0].active).toBe(true);
});

it("is idempotent — a second call links the existing row, not a duplicate", async () => {
  const again = await resolveOrProvisionOauthUser({ email: MAIL, name: "Oauth Person" });
  expect(again?.id).toBe((await resolveOrProvisionOauthUser({ email: MAIL, name: "x" }))?.id);
  const { rows } = await query("SELECT count(*)::int AS n FROM users WHERE email = $1", [MAIL]);
  expect(rows[0].n).toBe(1);
});

it("links an existing local account by (case-insensitive) email and keeps its role", async () => {
  const local = "oauthadmin@test.local";
  await query("DELETE FROM users WHERE email = $1", [local]);
  await query(`INSERT INTO users (email, name, password_hash, role) VALUES ($1, 'Local Admin', 'x', 'admin')`, [local]);
  const user = await resolveOrProvisionOauthUser({ email: `OAuthAdmin@Test.Local`, name: "Whatever" });
  expect(user?.role).toBe("admin");
  expect(user?.name).toBe("Local Admin");
});

it("rejects an inactive local account", async () => {
  const mail = "oauthinactive@test.local";
  await query("DELETE FROM users WHERE email = $1", [mail]);
  await query(`INSERT INTO users (email, name, password_hash, role, active) VALUES ($1, 'Off', 'x', 'user', false)`, [mail]);
  expect(await resolveOrProvisionOauthUser({ email: mail, name: "Off" })).toBeNull();
});

it("rejects an empty email", async () => {
  expect(await resolveOrProvisionOauthUser({ email: "  ", name: "No Email" })).toBeNull();
});
