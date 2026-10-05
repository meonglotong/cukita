// src/scripts/import.ts
// Import folder Markdown ke doc_pages. Subfolder → section, file .md → page
// (nama file = judul). Idempoten: slug yang sudah ada di DB di-skip (konten
// tidak di-overwrite — setelah import, editor web adalah sumber kebenaran).
// Usage: pnpm run import <folder-markdown>  ("pnpm import" = built-in pnpm cmd)
import "./load-env"; // must precede ../lib/db: fills DATABASE_URL from .env.local
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { query, closePool } from "../lib/db";
import { slugify } from "../lib/md/slugify";
import { runMigrations } from "./migrate";

export interface ImportResult { created: number; skipped: number }

export async function importDir(rootDir: string): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0 };

  const slugExists = async (slug: string) =>
    (await query("SELECT 1 FROM doc_pages WHERE slug = $1", [slug])).rows.length > 0;

  const level = async (dir: string, parentId: string | null): Promise<void> => {
    const entries = (await readdir(dir)).sort().filter((e) => !e.startsWith("."));
    const dirs: string[] = [];
    const files: string[] = [];
    for (const e of entries) {
      const st = await stat(path.join(dir, e));
      if (st.isDirectory()) dirs.push(e);
      else if (e.endsWith(".md")) files.push(e);
    }
    for (const d of dirs) {
      // section slug = NULL (invariant teamdocs) — dedup via (parent_id, title)
      const existing = (await query(
        "SELECT id FROM doc_pages WHERE is_section = true AND title = $1 AND parent_id IS NOT DISTINCT FROM $2",
        [d, parentId]
      )).rows[0]?.id as string | undefined;
      let sectionId: string;
      if (existing) {
        sectionId = existing;
        result.skipped++;
      } else {
        sectionId = (await query(
          `INSERT INTO doc_pages (title, slug, is_section, body_md, parent_id, position, updated_by)
           VALUES ($1, null, true, null, $2, 0, null) RETURNING id`,
          [d, parentId]
        )).rows[0].id;
        result.created++;
      }
      await level(path.join(dir, d), sectionId);
    }
    for (const f of files) {
      const title = f.replace(/\.md$/, "").replace(/[-_]/g, " ");
      const slug = slugify(title);
      if (await slugExists(slug)) { result.skipped++; continue; }
      const body = await readFile(path.join(dir, f), "utf8");
      await query(
        `INSERT INTO doc_pages (title, slug, is_section, body_md, parent_id, position, updated_by)
         VALUES ($1, $2, false, $3, $4, 0, null)`,
        [title, slug, body, parentId]
      );
      result.created++;
    }
  };

  await level(rootDir, null);
  return result;
}

if (process.argv[1]?.includes("import.ts")) {
  const dir = process.argv[2];
  if (!dir) { console.error("usage: pnpm import <folder-markdown>"); process.exit(1); }
  runMigrations()
    .then(() => importDir(path.resolve(dir)))
    .then((r) => { console.log(`import selesai: ${r.created} dibuat, ${r.skipped} di-skip (slug sudah ada)`); return closePool(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
