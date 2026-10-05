// src/lib/docs/service.test.ts
import { beforeAll, beforeEach, it, expect } from "vitest";
import { runMigrations } from "../../scripts/migrate";
import * as svc from "./service";
import { query, closePool } from "../db";

let adminId: string;

beforeAll(async () => {
  await runMigrations();
  await query("DELETE FROM doc_pages");
  // idempotent across runs: email is UNIQUE
  await query("DELETE FROM users WHERE email = 'svc@test.local'");
  const { rows: users } = await query(
    "INSERT INTO users (email, name, password_hash, role) VALUES ('svc@test.local','Svc','x','admin') RETURNING id"
  );
  adminId = users[0].id;
});

beforeEach(async () => {
  await query("DELETE FROM doc_pages"); // clean between tests
});

it("creates section + page, tree is ordered", async () => {
  const sec = await svc.createPage({ title: "Guide", slug: "guide", isSection: true, bodyMd: null, parentId: null, position: 0 }, adminId);
  const pg = await svc.createPage({ title: "Setup", slug: "setup", isSection: false, bodyMd: "## Halo\n\nisi", parentId: sec, position: 0 }, adminId);
  const tree = await svc.getPagesTree();
  expect(tree).toHaveLength(1);
  expect(tree[0].title).toBe("Guide");
  expect(tree[0].children.map((c) => c.title)).toEqual(["Setup"]);
  const bySlug = await svc.getPageBySlug("setup");
  expect(bySlug?.bodyMd).toBe("## Halo\n\nisi");
});

it("rejects deleting a section with children", async () => {
  const sec = await svc.createPage({ title: "S2", slug: "s2", isSection: true, bodyMd: null, parentId: null, position: 5 }, adminId);
  await svc.createPage({ title: "P2", slug: "p2", isSection: false, bodyMd: "x", parentId: sec, position: 0 }, adminId);
  await expect(svc.deletePage(sec)).rejects.toMatchObject({ code: "HAS_CHILDREN" });
});

it("searches title and body", async () => {
  await svc.createPage({ title: "Zebra API", slug: "zebra-api", isSection: false, bodyMd: "kata unik: zebrafeed", parentId: null, position: 9 }, adminId);
  const byTitle = await svc.searchDocs("zebra api");
  expect(byTitle.some((r) => r.slug === "zebra-api")).toBe(true);
  const byBody = await svc.searchDocs("zebrafeed");
  expect(byBody.some((r) => r.slug === "zebra-api")).toBe(true);
});
