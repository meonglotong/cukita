// src/scripts/import.test.ts
import { beforeAll, beforeEach, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMigrations } from "./migrate";
import { importDir } from "./import";
import { query } from "../lib/db";

let dir: string;

beforeAll(async () => { await runMigrations(); });

beforeEach(async () => {
  await query("DELETE FROM doc_pages WHERE slug LIKE 'imp%'");
  dir = await mkdtemp(path.join(tmpdir(), "teamkb-import-"));
  await mkdir(path.join(dir, "ImpGuide"), { recursive: true });
  // file boleh punya H1 sendiri — judul page diambil dari H1 itu (slug
  // ikut), biar tidak dobel dengan header page
  await writeFile(path.join(dir, "imp-intro.md"), "# Imp Intro\n\nhalo");
  await writeFile(path.join(dir, "ImpGuide", "imp-setup.md"), "# Imp Setup");
});

// section slug = NULL (invariant), jadi query section via title + is_section
const IMPORTED = "slug IN ('imp-intro','imp-setup') OR (is_section AND title = 'ImpGuide')";

it("maps subfolders to sections and .md files to pages", async () => {
  const r = await importDir(dir);
  expect(r).toEqual({ created: 3, skipped: 0 });
  const { rows } = await query(
    `SELECT title, is_section FROM doc_pages WHERE ${IMPORTED} ORDER BY title`
  );
  expect(rows).toHaveLength(3);
  expect(rows.some((x) => x.is_section === true && x.title === "ImpGuide")).toBe(true);
  expect(rows.some((x) => x.title === "Imp Intro")).toBe(true);
});

it("is idempotent: second run skips existing entries", async () => {
  await importDir(dir);
  const r2 = await importDir(dir);
  expect(r2).toEqual({ created: 0, skipped: 3 });
  const { rows } = await query(`SELECT count(*)::int n FROM doc_pages WHERE ${IMPORTED}`);
  expect(rows[0].n).toBe(3);
});
