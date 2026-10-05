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
  const all = useMemo(() => flatten(tree), [tree]);
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [add, setAdd] = useState({ title: "", parentId: "", isSection: false, bodyMd: "" });
  const [addMsg, setAddMsg] = useState("");

  const shown = visibleTree(tree, filter.trim());

  const render = (nodes: Node[], depth: number) => (
    <ul style={{ paddingLeft: depth ? 14 : 0 }}>
      {nodes.map((n) => {
        const isCollapsed = !!collapsed[n.id];
        const active = pathname === `/docs/${n.slug}`;
        return (
          <li key={n.id}>
            {n.isSection ? (
              <button type="button" className="side-section-row"
                onClick={() => setCollapsed((c) => ({ ...c, [n.id]: !c[n.id] }))}>
                <span className={`chev${isCollapsed ? "" : " open"}`}>▶</span>
                {n.title}
              </button>
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

  const saveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      const siblings = add.parentId
        ? all.filter((p) => p.parentId === add.parentId).length
        : all.filter((p) => p.parentId === null).length;
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: add.title,
          isSection: add.isSection,
          bodyMd: add.isSection ? null : add.bodyMd,
          parentId: add.parentId || null,
          position: siblings,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setAddMsg(json.error ?? "gagal disimpan"); return; }
      setAdd({ title: "", parentId: "", isSection: false, bodyMd: "" });
      setAddMsg("");
      setShowAdd(false);
      router.refresh();
    })();
  };

  return (
    <nav className="docs-sidebar">
      <input className="sidebar-filter" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {render(shown, 0)}
      <button type="button" className="btn" style={{ width: "100%" }} onClick={() => setShowAdd((v) => !v)}>
        + Tambah
      </button>
      {showAdd ? (
        <form className="sidebar-add" onSubmit={saveAdd}>
          <h4>Tambah halaman</h4>
          <input required placeholder="judul" value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} />
          <select value={add.parentId} onChange={(e) => setAdd({ ...add, parentId: e.target.value })}>
            <option value="">(root)</option>
            {all.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>
            <input type="checkbox" checked={add.isSection} onChange={(e) => setAdd({ ...add, isSection: e.target.checked })} />
            {" "}section (tanpa konten)
          </label>
          {!add.isSection ? (
            <textarea rows={4} placeholder="isi markdown" value={add.bodyMd} onChange={(e) => setAdd({ ...add, bodyMd: e.target.value })} />
          ) : null}
          {addMsg ? <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{addMsg}</p> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">Simpan</button>
            <button type="button" className="btn" onClick={() => setShowAdd(false)}>Batal</button>
          </div>
        </form>
      ) : null}
    </nav>
  );
}
