// src/app/api/docs/route.test.ts
import { beforeAll, it, expect, vi } from "vitest";
import { runMigrations } from "@/scripts/migrate";
import { query } from "@/lib/db";
import { GET, POST } from "./route";
import { fakeUserSession } from "@/test/fixtures";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

beforeAll(async () => {
  await runMigrations();
  // id user dari mock harus valid untuk FK doc_pages.updated_by
  await query(
    `INSERT INTO users (id, email, name, password_hash, role)
     VALUES ($1, 'docs-test-user@local', 'DocsTest', 'x', 'user')
     ON CONFLICT (id) DO NOTHING`,
    [fakeUserSession.user.id]
  );
  await query("DELETE FROM doc_pages WHERE slug LIKE 'api-%'");
});

it("GET: lists pages for a regular user (not just admin)", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await GET(new Request("http://t/api/docs"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

it("POST: regular user can create a page (201)", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await POST(new Request("http://t/api/docs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Api Test", isSection: false, bodyMd: "x", position: 0 }),
  }));
  expect(res.status).toBe(201);
});

it("401 without session", async () => {
  globalThis.__TEST_SESSION__ = null;
  expect((await GET(new Request("http://t/api/docs"))).status).toBe(401);
  const res = await POST(new Request("http://t/api/docs", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Nope", isSection: false, bodyMd: "x" }),
  }));
  expect(res.status).toBe(401);
});
