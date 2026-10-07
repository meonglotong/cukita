// src/app/api/account/password/route.test.ts
import { beforeAll, it, expect, vi } from "vitest";
import { runMigrations } from "@/scripts/migrate";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { POST } from "./route";
import { fakeUserSession } from "@/test/fixtures";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

beforeAll(async () => {
  await runMigrations();
  globalThis.__TEST_SESSION__ = fakeUserSession;
  await query("DELETE FROM users WHERE id = $1", [fakeUserSession.user.id]);
  await query(
    `INSERT INTO users (id, email, name, password_hash, role)
     VALUES ($1, 'acct-test@local', 'AcctTest', $2, 'user')`,
    [fakeUserSession.user.id, await hashPassword("current123")]
  );
});

it("401 without session", async () => {
  globalThis.__TEST_SESSION__ = null;
  const res = await POST(new Request("http://t/api/account/password", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ current: "x", next: "y" }),
  }));
  expect(res.status).toBe(401);
});

it("401 when current password is wrong", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await POST(new Request("http://t/api/account/password", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ current: "salah123", next: "newpass456" }),
  }));
  expect(res.status).toBe(401);
});

it("400 when new password is too short", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await POST(new Request("http://t/api/account/password", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ current: "current123", next: "pendek" }),
  }));
  expect(res.status).toBe(400);
});

it("200 and the new password works", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await POST(new Request("http://t/api/account/password", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ current: "current123", next: "newpass456" }),
  }));
  expect(res.status).toBe(200);
  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [fakeUserSession.user.id]);
  const { verifyPassword } = await import("@/lib/password");
  expect(await verifyPassword(rows[0].password_hash, "newpass456")).toBe(true);
});
