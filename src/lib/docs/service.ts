// src/lib/docs/service.ts
import { query } from "../db";
import { slugify } from "../md/slugify";

export interface PageNode { id: string; title: string; slug: string | null; isSection: boolean; position: number; parentId: string | null; bodyMd: string | null }
export interface TreeNode { id: string; title: string; slug: string | null; isSection: boolean; parentId: string | null; children: TreeNode[] }

export async function listPages(): Promise<PageNode[]> {
  const { rows } = await query(
    `SELECT id, title, slug, is_section AS "isSection", position, parent_id AS "parentId", body_md AS "bodyMd"
     FROM doc_pages ORDER BY parent_id NULLS FIRST, position, title`
  );
  return rows as PageNode[];
}

export async function getPagesTree(): Promise<TreeNode[]> {
  const all = await listPages();
  const byId = new Map<string, TreeNode>();
  for (const p of all) {
    byId.set(p.id, { id: p.id, title: p.title, slug: p.slug, isSection: p.isSection, parentId: p.parentId, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const p of all) {
    const node = byId.get(p.id)!;
    const parent = p.parentId ? byId.get(p.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function getPageBySlug(slug: string) {
  const { rows } = await query(
    `SELECT id, title, body_md AS "bodyMd", parent_id AS "parentId", updated_at AS "updatedAt"
     FROM doc_pages WHERE slug = $1 AND is_section = false`, [slug]);
  return rows[0] ?? null;
}

export async function createPage(input: { title: string; slug: string; isSection: boolean; bodyMd: string | null; parentId: string | null; position: number }, userId: string): Promise<string> {
  const { rows } = await query(
    `INSERT INTO doc_pages (title, slug, is_section, body_md, parent_id, position, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [input.title, input.isSection ? null : input.slug, input.isSection, input.bodyMd, input.parentId, input.position, userId]
  );
  return rows[0].id;
}

export async function updatePage(id: string, patch: Partial<{ title: string; slug: string; isSection: boolean; bodyMd: string | null; parentId: string | null; position: number }>, userId: string): Promise<{ slug: string | null }> {
  const cur = (await query("SELECT * FROM doc_pages WHERE id = $1", [id])).rows[0];
  if (!cur) throw Object.assign(new Error("not found"), { code: "NOT_FOUND" });
  const isSection = patch.isSection ?? cur.is_section;
  const title = patch.title ?? cur.title;
  let slug: string | null;
  if (isSection) {
    slug = null;
  } else if (patch.title !== undefined && title !== cur.title) {
    // spec §4: rename → slug dibuat ulang; bentrok dengan baris lain → 409
    slug = slugify(title);
    const clash = (await query("SELECT 1 FROM doc_pages WHERE slug = $1 AND id <> $2", [slug, id])).rows.length > 0;
    if (clash) throw Object.assign(new Error("slug taken"), { code: "SLUG_TAKEN" });
  } else {
    slug = patch.slug ?? cur.slug;
  }
  await query(
    `UPDATE doc_pages SET title=$2, slug=$3, is_section=$4, body_md=$5, parent_id=$6, position=$7, updated_by=$8, updated_at=now() WHERE id=$1`,
    [id, title, slug, isSection, patch.bodyMd ?? cur.body_md, patch.parentId ?? cur.parent_id, patch.position ?? cur.position, userId]
  );
  return { slug };
}

export async function deletePage(id: string): Promise<void> {
  const { rows } = await query("SELECT count(*)::int AS n FROM doc_pages WHERE parent_id = $1", [id]);
  if (rows[0].n > 0) throw Object.assign(new Error("has children"), { code: "HAS_CHILDREN" });
  await query("DELETE FROM doc_pages WHERE id = $1", [id]);
}

export async function searchDocs(q: string): Promise<{ slug: string; title: string; snippet: string }[]> {
  const { rows } = await query(
    `SELECT slug, title, left(replace(body_md, E'\n', ' '), 200) AS snippet
     FROM doc_pages
     WHERE is_section = false AND (title ILIKE $1 OR body_md ILIKE $1)
     ORDER BY updated_at DESC LIMIT 50`,
    [`%${q}%`]
  );
  return rows as { slug: string; title: string; snippet: string }[];
}
