// src/app/api/admin/users/[id]/route.test.ts
import { beforeAll, it, expect, vi } from "vitest";
import { runMigrations } from "../../../../../scripts/migrate";
import { query } from "../../../../../lib/db";
import { PATCH, DELETE } from "./route";
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

const del = (session: unknown, id: string) => {
  globalThis.__TEST_SESSION__ = session;
  return DELETE(new Request("http://t/api/admin/users/" + id, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
};

it("DELETE: admin is not allowed (403)", async () => {
  const res = await del(fakeAdminSession, fakeUserSession.user.id);
  expect(res.status).toBe(403);
});

it("DELETE: last superadmin cannot be deleted (409)", async () => {
  const res = await del(fakeSuperAdminSession, superId);
  expect(res.status).toBe(409);
  const { rows } = await query("SELECT count(*)::int AS n FROM users WHERE id = $1", [superId]);
  expect(rows[0].n).toBe(1);
});

it("DELETE: superadmin deletes a user — attempts cascade, docs become anonymous", async () => {
  const { rows } = await query(
    `INSERT INTO users (email, name, role) VALUES ('todelete@test.local', 'To Delete', 'user') RETURNING id`
  );
  const uid = rows[0].id as string;
  await query(`INSERT INTO quiz_attempts (user_id, track, score, total, passed) VALUES ($1, 'dba', 5, 60, false)`, [uid]);
  await query(`INSERT INTO doc_pages (title, slug, author_id) VALUES ('Doc', 'todelete-doc', $1)`, [uid]);

  const res = await del(fakeSuperAdminSession, uid);
  expect(res.status).toBe(200);

  const { rows: left } = await query("SELECT count(*)::int AS n FROM users WHERE id = $1", [uid]);
  expect(left[0].n).toBe(0);
  const { rows: attempts } = await query("SELECT count(*)::int AS n FROM quiz_attempts WHERE user_id = $1", [uid]);
  expect(attempts[0].n).toBe(0); // ON DELETE CASCADE
  const { rows: docs } = await query("SELECT author_id FROM doc_pages WHERE slug = 'todelete-doc'");
  expect(docs[0].author_id).toBeNull(); // ON DELETE SET NULL
  // cleanup docs for the shared test DB
  await query("DELETE FROM doc_pages WHERE slug = 'todelete-doc'");
});

it("DELETE: unknown id is 404", async () => {
  const res = await del(fakeSuperAdminSession, "00000000-0000-0000-0000-999999999999");
  expect(res.status).toBe(404);
});
