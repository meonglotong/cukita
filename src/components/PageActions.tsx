// src/components/PageActions.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface FlatNode { id: string; title: string }

export function PageActions({ pageId, pageTitle, parentId, flat }: {
  pageId: string; pageTitle: string; parentId: string | null; flat: FlatNode[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(pageTitle);
  const [msg, setMsg] = useState("");

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/docs/${pageId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? "gagal"); return; }
    setMsg("");
    if (typeof json.slug === "string" && json.slug) {
      // rename → slug baru: pindahkan URL biar tidak stale
      router.push(`/docs/${json.slug}`);
    }
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("Hapus halaman ini?")) return;
    const res = await fetch(`/api/docs/${pageId}`, { method: "DELETE" });
    if (res.status === 409) { setMsg("tidak bisa dihapus: masih punya halaman anak"); return; }
    if (!res.ok) { const j = await res.json(); setMsg(j.error ?? "gagal"); return; }
    router.push("/docs");
    router.refresh();
  };

  return (
    <details className="page-menu">
      <summary>⋮</summary>
      <div className="menu-body">
        {msg ? <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>{msg}</p> : null}
        <div>
          <h5>Ubah judul</h5>
          <div className="row">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
            <button type="button" className="btn" onClick={() => void patch({ title })}>OK</button>
          </div>
        </div>
        <div>
          <h5>Pindah ke</h5>
          <div className="row">
            <select defaultValue={parentId ?? ""} id={`move-${pageId}`}>
              <option value="">(root)</option>
              {flat.filter((p) => p.id !== pageId).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <button type="button" className="btn" onClick={() => {
              const sel = document.getElementById(`move-${pageId}`) as HTMLSelectElement;
              void patch({ parentId: sel.value || null });
            }}>OK</button>
          </div>
        </div>
        <button type="button" className="btn btn-danger" onClick={() => void remove()}>Hapus halaman</button>
      </div>
    </details>
  );
}
