// src/app/api/admin/users/[id]/route.test.ts
import { beforeAll, it, expect, vi } from "vitest";
import { runMigrations } from "../../../../../scripts/migrate";
import { query } from "../../../../../lib/db";
import { PATCH } from "./route";
import { fakeAdminSession, fakeSuperAdminSession, fakeUserSession } from "../../../../../test/fixtures";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

let superId: string; // the one superadmin in the test DB

beforeAll(async () => {
  await runMigrations();
  // deterministic baseline: exactly one superadmin, one admin, one user.
  // The shared test DB may hold leftovers from other test files (e.g. the
  // "role menu" test creates a superadmin), so sweep extra superadmins.
  await query("DELETE FROM users WHERE role = 'superadmin' AND id <> $1", [fakeSuperAdminSession.user.id]);
  await query("DELETE FROM users WHERE id = ANY($1)", [[
    fakeSuperAdminSession.user.id, fakeAdminSession.user.id, fakeUserSession.user.id,
  ]]);
  for (const s of [fakeSuperAdminSession, fakeAdminSession, fakeUserSession]) {
    await query(
      `INSERT INTO users (id, email, name, password_hash, role)
       VALUES ($1, $2, 'T', 'x', $3)`,
      [s.user.id, s.user.email, s.user.role]
    );
  }
  superId = fakeSuperAdminSession.user.id;
  globalThis.__TEST_SESSION__ = fakeSuperAdminSession;
});

const patch = (session: unknown, id: string, body: unknown) => {
  globalThis.__TEST_SESSION__ = session;
  return PATCH(new Request("http://t/api/admin/users/" + id, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });
};

it("PATCH: admin is no longer allowed (403)", async () => {
  const res = await patch(fakeAdminSession, fakeUserSession.user.id, { name: "X" });
  expect(res.status).toBe(403);
});

it("PATCH: superadmin updates name + role", async () => {
  const res = await patch(fakeSuperAdminSession, fakeUserSession.user.id, { name: "Renamed", role: "admin" });
  expect(res.status).toBe(200);
  const { rows } = await query("SELECT name, role FROM users WHERE id = $1", [fakeUserSession.user.id]);
  expect(rows[0]).toEqual({ name: "Renamed", role: "admin" });
  await patch(fakeSuperAdminSession, fakeUserSession.user.id, { name: "User", role: "user" });
});

it("PATCH: promoting a second superadmin is 409", async () => {
  const res = await patch(fakeSuperAdminSession, fakeAdminSession.user.id, { role: "superadmin" });
  expect(res.status).toBe(409);
});

it("PATCH: the last superadmin cannot demote themselves", async () => {
  const res = await patch(fakeSuperAdminSession, superId, { role: "admin" });
  expect(res.status).toBe(409);
});

it("PATCH: the last superadmin cannot deactivate themselves", async () => {
  const res = await patch(fakeSuperAdminSession, superId, { active: false });
  expect(res.status).toBe(409);
});

it("PATCH: superadmin can deactivate someone else", async () => {
  const res = await patch(fakeSuperAdminSession, fakeUserSession.user.id, { active: false });
  expect(res.status).toBe(200);
  await patch(fakeSuperAdminSession, fakeUserSession.user.id, { active: true });
});
