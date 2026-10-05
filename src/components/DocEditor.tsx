// src/components/DocEditor.tsx
"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/md/render";

interface ParentOption { id: string; title: string }

export function DocEditor({ pageId, initialTitle, initialBody, initialParentId, parents }: {
  pageId: string; initialTitle: string; initialBody: string;
  initialParentId: string | null; parents: ParentOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [parentId, setParentId] = useState(initialParentId ?? "");
  const [msg, setMsg] = useState("");
  const previewHtml = useMemo(() => renderMarkdown(body).html, [body]);

  const save = async () => {
    const res = await fetch(`/api/docs/${pageId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, bodyMd: body, parentId: parentId || null }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? "gagal disimpan"); return; }
    router.push(`/docs/${json.slug}`);
    router.refresh();
  };

  return (
    <div>
      <div className="editor-toolbar">
        <h2>Edit halaman</h2>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => router.back()}>Batal</button>
          <button type="button" className="btn btn-primary" onClick={() => void save()}>Simpan</button>
        </span>
      </div>
      {msg ? <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 16px" }}>{msg}</p> : null}
      <div className="field" style={{ marginBottom: 16, maxWidth: 480 }}>
        <label>Judul</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field" style={{ marginBottom: 20, maxWidth: 480 }}>
        <label>Section</label>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">(root)</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div className="editor-layout">
        <div className="editor-pane">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="editor-pane">
          <div className="pane-body markdown-body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </div>
    </div>
  );
}
