// src/app/api/docs/[id]/route.test.ts
import { beforeAll, it, expect, vi } from "vitest";
import { runMigrations } from "@/scripts/migrate";
import { query } from "@/lib/db";
import { PATCH, DELETE } from "./route";
import { fakeUserSession } from "@/test/fixtures";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

let pageId: string;

beforeAll(async () => {
  await runMigrations();
  globalThis.__TEST_SESSION__ = fakeUserSession;
  // id user dari mock harus valid untuk FK doc_pages.updated_by
  await query(
    `INSERT INTO users (id, email, name, password_hash, role)
     VALUES ($1, 'docs-test-user@local', 'DocsTest', 'x', 'user')
     ON CONFLICT (id) DO NOTHING`,
    [fakeUserSession.user.id]
  );
  // DB persist antar-run: bersihkan (child dulu — RESTRICT di parent)
  await query("DELETE FROM doc_pages WHERE slug = 'api-child'");
  await query("DELETE FROM doc_pages WHERE slug = 'api-patchme'");
  const { rows } = await query(
    `INSERT INTO doc_pages (title, slug, is_section, body_md, position)
     VALUES ('Patch Me', 'api-patchme', false, 'old', 0) RETURNING id`
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
