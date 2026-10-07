// src/lib/docs/service.test.ts
import { beforeAll, beforeEach, describe, it, expect } from "vitest";
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
  const pg = await svc.createPage({ title: "Setup", slug: "setup", isSection: false, bodyMd: "## Halo\n\nisi", parentId: sec.id, position: 0 }, adminId);
  const tree = await svc.getPagesTree();
  expect(tree).toHaveLength(1);
  expect(tree[0].title).toBe("Guide");
  expect(tree[0].children.map((c) => c.title)).toEqual(["Setup"]);
  const bySlug = await svc.getPageBySlug("setup");
  expect(bySlug?.bodyMd).toBe("## Halo\n\nisi");
});

it("rejects deleting a section with children", async () => {
  const sec = await svc.createPage({ title: "S2", slug: "s2", isSection: true, bodyMd: null, parentId: null, position: 5 }, adminId);
  await svc.createPage({ title: "P2", slug: "p2", isSection: false, bodyMd: "x", parentId: sec.id, position: 0 }, adminId);
  await expect(svc.deletePage(sec.id)).rejects.toMatchObject({ code: "HAS_CHILDREN" });
});

it("searches title and body", async () => {
  await svc.createPage({ title: "Zebra API", slug: "zebra-api", isSection: false, bodyMd: "kata unik: zebrafeed", parentId: null, position: 9 }, adminId);
  const byTitle = await svc.searchDocs("zebra api");
  expect(byTitle.some((r) => r.slug === "zebra-api")).toBe(true);
  const byBody = await svc.searchDocs("zebrafeed");
  expect(byBody.some((r) => r.slug === "zebra-api")).toBe(true);
});

it("tree nodes expose parentId", async () => {
  const sec = await svc.createPage({ title: "TP Sec", slug: "tp-sec", isSection: true, bodyMd: null, parentId: null, position: 0 }, adminId);
  await svc.createPage({ title: "TP Page", slug: "tp-page", isSection: false, bodyMd: "x", parentId: sec.id, position: 0 });
  const tree = await svc.getPagesTree();
  expect(tree[0].children[0].parentId).toBe(sec.id);
  expect(tree[0].parentId).toBeNull();
});

it("rename regenerates slug; collision throws SLUG_TAKEN", async () => {
  const a = await svc.createPage({ title: "Old Name", slug: "old-name", isSection: false, bodyMd: "x", parentId: null, position: 0 }, adminId);
  await svc.createPage({ title: "Other", slug: "other", isSection: false, bodyMd: "y", parentId: null, position: 1 }, adminId);
  const r = await svc.updatePage(a.id, { title: "Brand New" }, adminId);
  expect(r.slug).toBe("brand-new");
  await expect(svc.updatePage(a.id, { title: "Other" }, adminId)).rejects.toMatchObject({ code: "SLUG_TAKEN" });
});

it("createPage de-dupes a taken slug with a numeric suffix", async () => {
  const first = await svc.createPage({ title: "Untitled", slug: "untitled", isSection: false, bodyMd: "", parentId: null, position: 0 }, adminId);
  const second = await svc.createPage({ title: "Untitled", slug: "untitled", isSection: false, bodyMd: "", parentId: null, position: 1 }, adminId);
  expect(first.slug).toBe("untitled");
  expect(second.slug).toBe("untitled-2");
});

describe("ownership", () => {
  let memberId: string;

  beforeAll(async () => {
    await query("DELETE FROM users WHERE email = 'member@test.local'");
    const { rows } = await query(
      "INSERT INTO users (email, name, password_hash, role) VALUES ('member@test.local','Member','x','user') RETURNING id"
    );
    memberId = rows[0].id;
  });

  it("canEditPage: author yes, superadmin yes; admin & stranger no; legacy (null) superadmin-only", () => {
    expect(svc.canEditPage(adminId, { id: adminId, role: "user" })).toBe(true);
    expect(svc.canEditPage(memberId, { id: adminId, role: "superadmin" })).toBe(true);
    expect(svc.canEditPage(memberId, { id: adminId, role: "admin" })).toBe(false);
    expect(svc.canEditPage(memberId, { id: "someone-else", role: "user" })).toBe(false);
    expect(svc.canEditPage(null, { id: adminId, role: "user" })).toBe(false);
    expect(svc.canEditPage(null, { id: adminId, role: "admin" })).toBe(false);
    expect(svc.canEditPage(null, { id: adminId, role: "superadmin" })).toBe(true);
  });

  it("createPage records the author; getPageBySlug exposes authorId + authorName", async () => {
    const pg = await svc.createPage({ title: "Owned", slug: "owned", isSection: false, bodyMd: "x", parentId: null, position: 0 }, memberId);
    expect(pg.id).toBeTruthy();
    const bySlug = await svc.getPageBySlug("owned");
    expect(bySlug?.authorId).toBe(memberId);
    expect(bySlug?.authorName).toBe("Member");
  });
});
