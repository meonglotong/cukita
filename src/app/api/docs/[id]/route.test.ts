// src/app/api/docs/[id]/route.test.ts
import { beforeAll, describe, it, expect, vi } from "vitest";
import { runMigrations } from "@/scripts/migrate";
import { query } from "@/lib/db";
import { PATCH, DELETE } from "./route";
import { fakeAdminSession, fakeUserSession } from "@/test/fixtures";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

let pageId: string;

beforeAll(async () => {
  await runMigrations();
  globalThis.__TEST_SESSION__ = fakeUserSession;
  // id user dari mock harus valid untuk FK doc_pages.updated_by/author_id
  for (const s of [fakeUserSession, fakeAdminSession]) {
    await query(
      `INSERT INTO users (id, email, name, password_hash, role)
       VALUES ($1, $2, 'DocsTest', 'x', 'user')
       ON CONFLICT (id) DO NOTHING`,
      [s.user.id, `docs-test-${s.user.id.slice(-2)}@local`]
    );
  }
  // DB persist antar-run: bersihkan (child dulu — RESTRICT di parent)
  await query("DELETE FROM doc_pages WHERE slug = 'api-child'");
  await query("DELETE FROM doc_pages WHERE slug = 'api-patchme'");
  const { rows } = await query(
    `INSERT INTO doc_pages (title, slug, is_section, body_md, position, author_id)
     VALUES ('Patch Me', 'api-patchme', false, 'old', 0, $1) RETURNING id`,
    [fakeUserSession.user.id]
  );
  pageId = rows[0].id;
});

it("PATCH: regular user updates title+body", async () => {
  const res = await PATCH(new Request(`http://t/api/docs/${pageId}`, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Patched", bodyMd: "new" }),
  }), { params: Promise.resolve({ id: pageId }) });
  expect(res.status).toBe(200);
  const { rows } = await query("SELECT title, body_md FROM doc_pages WHERE id = $1", [pageId]);
  expect(rows[0]).toEqual({ title: "Patched", body_md: "new" });
});

it("DELETE: 409 when page has children", async () => {
  await query(
    `INSERT INTO doc_pages (title, slug, is_section, body_md, parent_id, position)
     VALUES ('Child', 'api-child', false, 'c', $1, 0)`, [pageId]
  );
  const res = await DELETE(new Request(`http://t/api/docs/${pageId}`), { params: Promise.resolve({ id: pageId }) });
  expect(res.status).toBe(409);
});

it("401 without session", async () => {
  globalThis.__TEST_SESSION__ = null;
  const res = await PATCH(new Request(`http://t/api/docs/${pageId}`, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "x" }),
  }), { params: Promise.resolve({ id: pageId }) });
  expect(res.status).toBe(401);
});

describe("ownership", () => {
  it("PATCH: non-author regular user gets 403, admin passes", async () => {
    globalThis.__TEST_SESSION__ = fakeUserSession;
    const byAuthor = await PATCH(new Request(`http://t/api/docs/${pageId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "By Author" }),
    }), { params: Promise.resolve({ id: pageId }) });
    expect(byAuthor.status).toBe(200);

    // user lain (admin session dipakai sebagai "orang lain" setelah role diubah)
    const stranger = { user: { ...fakeAdminSession.user, role: "user" as const } };
    globalThis.__TEST_SESSION__ = stranger;
    const byStranger = await PATCH(new Request(`http://t/api/docs/${pageId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "By Stranger" }),
    }), { params: Promise.resolve({ id: pageId }) });
    expect(byStranger.status).toBe(403);

    globalThis.__TEST_SESSION__ = fakeAdminSession;
    const byAdmin = await PATCH(new Request(`http://t/api/docs/${pageId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "By Admin" }),
    }), { params: Promise.resolve({ id: pageId }) });
    expect(byAdmin.status).toBe(200);
  });

  it("DELETE: non-author regular user gets 403", async () => {
    const stranger = { user: { ...fakeAdminSession.user, role: "user" as const } };
    globalThis.__TEST_SESSION__ = stranger;
    const res = await DELETE(new Request(`http://t/api/docs/${pageId}`), { params: Promise.resolve({ id: pageId }) });
    expect(res.status).toBe(403);
    globalThis.__TEST_SESSION__ = fakeUserSession;
  });
});
