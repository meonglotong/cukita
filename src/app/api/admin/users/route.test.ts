// src/app/api/admin/users/route.test.ts
import { beforeAll, it, expect, vi } from "vitest";
import { runMigrations } from "../../../../scripts/migrate";
import { query } from "../../../../lib/db";
import { GET, POST } from "./route";
import { fakeAdminSession, fakeSuperAdminSession, fakeUserSession } from "../../../../test/fixtures";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

beforeAll(async () => {
  await runMigrations();
  globalThis.__TEST_SESSION__ = fakeAdminSession;
  // DB persists between runs; keep "new user" assertions deterministic
  await query("DELETE FROM users WHERE email LIKE '%admin@test.local'");
  await query("DELETE FROM users WHERE email = 'u1@team.local'");
});

it("lists users", async () => {
  const res = await GET(new Request("http://t/api/admin/users"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.users)).toBe(true);
});

it("creates user 201, duplicate 409", async () => {
  const mk = (body: unknown) => POST(new Request("http://t/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  expect((await mk({ email: "u1@team.local", name: "U1", password: "pw123456", role: "user" })).status).toBe(201);
  expect((await mk({ email: "u1@team.local", name: "U1", password: "pw123456", role: "user" })).status).toBe(409);
});

it("role menu: admin cannot create a superadmin, superadmin can", async () => {
  const mk = (body: unknown) => POST(new Request("http://t/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  await query("DELETE FROM users WHERE email = 'u-super@team.local'");
  globalThis.__TEST_SESSION__ = fakeAdminSession;
  expect((await mk({ email: "u-super@team.local", name: "U", password: "pw123456", role: "superadmin" })).status).toBe(400);
  globalThis.__TEST_SESSION__ = fakeSuperAdminSession;
  expect((await mk({ email: "u-super@team.local", name: "U", password: "pw123456", role: "superadmin" })).status).toBe(201);
});

it("rejects unauthenticated with 401", async () => {
  globalThis.__TEST_SESSION__ = null;
  const res = await GET(new Request("http://t/api/admin/users"));
  expect(res.status).toBe(401);
});

it("rejects non-admin with 403", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await GET(new Request("http://t/api/admin/users"));
  expect(res.status).toBe(403);
});
