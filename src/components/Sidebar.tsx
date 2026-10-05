// src/components/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface Node { id: string; title: string; slug: string | null; isSection: boolean; parentId: string | null; children: Node[] }

function flatten(nodes: Node[], out: Node[] = []): Node[] {
  for (const n of nodes) { out.push(n); flatten(n.children, out); }
  return out;
}

// Filter: halaman yang judulnya match tetap tampil; section tetap tampil
// jika dirinya match ATAU punya keturunan yang match.
function visibleTree(nodes: Node[], filter: string): Node[] {
  if (!filter) return nodes;
  const f = filter.toLowerCase();
  const walk = (list: Node[]): Node[] =>
    list
      .map((n) => {
        const kids = walk(n.children);
        const selfHit = n.title.toLowerCase().includes(f);
        if (selfHit) return n;
        if (kids.length > 0) return { ...n, children: kids };
        return null;
      })
      .filter((n): n is Node => n !== null);
  return walk(nodes);
}

export function Sidebar({ tree }: { tree: Node[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const shown = visibleTree(tree, filter.trim());

  // Notion-style: one click creates an "Untitled" page and opens the editor
  // straight away. parentId null = root.
  const addPage = async (parentId: string | null, position: number) => {
    if (busy) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/docs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled", isSection: false, bodyMd: "", parentId, position }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(json.error ?? "gagal membuat halaman"); return; }
    router.push(`/docs/${json.slug}/edit`);
  };

  const render = (nodes: Node[], depth: number) => (
    <ul style={{ paddingLeft: depth ? 14 : 0 }}>
      {nodes.map((n) => {
        const isCollapsed = !!collapsed[n.id];
        const active = pathname === `/docs/${n.slug}` || pathname === `/docs/${n.slug}/edit`;
        return (
          <li key={n.id} className="side-item">
            {n.isSection ? (
              <div className="side-section-row-wrap">
                <button type="button" className="side-section-row"
                  onClick={() => setCollapsed((c) => ({ ...c, [n.id]: !c[n.id] }))}>
                  <span className={`chev${isCollapsed ? "" : " open"}`}>▶</span>
                  {n.title}
                </button>
                <button type="button" className="side-add-btn" title="Tambah halaman di sini"
                  onClick={() => void addPage(n.id, n.children.length)}>
                  +
                </button>
              </div>
            ) : (
              <Link href={`/docs/${n.slug}`} className={`side-link${active ? " active" : ""}`}>
                {n.title}
              </Link>
            )}
            {n.children.length > 0 && !(n.isSection && isCollapsed) ? render(n.children, depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav className="docs-sidebar">
      <input className="sidebar-filter" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {render(shown, 0)}
      {err ? <p className="sidebar-err">{err}</p> : null}
      <button type="button" className="btn" style={{ width: "100%" }} disabled={busy}
        onClick={() => void addPage(null, tree.length)}>
        + Tambah
      </button>
    </nav>
  );
}
