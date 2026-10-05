// src/components/DocEditor.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

interface ParentOption { id: string; title: string }

function ToolbarButton({ onClick, title, active, children }: {
  onClick: () => void; title: string; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" title={title} className={`toolbar-btn${active ? " active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="editor-toolbar-row">
      <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>↺</ToolbarButton>
      <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>↻</ToolbarButton>
      <span className="toolbar-sep" />
      <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolbarButton>
      <ToolbarButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolbarButton>
      <ToolbarButton title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>{"</>"}</ToolbarButton>
      <span className="toolbar-sep" />
      <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
      <ToolbarButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
      <span className="toolbar-sep" />
      <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarButton>
      <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarButton>
      <ToolbarButton title="Task list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>☑</ToolbarButton>
      <span className="toolbar-sep" />
      <ToolbarButton title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolbarButton>
      <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"{ }"}</ToolbarButton>
      <ToolbarButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</ToolbarButton>
    </div>
  );
}

export function DocEditor({ pageId, initialTitle, initialBody, initialParentId, parents }: {
  pageId: string; initialTitle: string; initialBody: string;
  initialParentId: string | null; parents: ParentOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [parentId, setParentId] = useState(initialParentId ?? "");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: initialBody,
  });

  const save = async () => {
    if (!editor) return;
    setSaving(true);
    const res = await fetch(`/api/docs/${pageId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, bodyMd: editor.getMarkdown(), parentId: parentId || null }),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? "gagal disimpan"); return; }
    router.push(`/docs/${json.slug}`);
    router.refresh();
  };

  return (
    <div className="doc-editor">
      <div className="editor-topbar">
        <button type="button" className="btn" onClick={() => router.back()}>← Keluar</button>
        <span className="editor-save-status" />
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
      {msg ? <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 12px" }}>{msg}</p> : null}
      <input
        className="doc-title-input"
        placeholder="Untitled"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {editor ? (
        <>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} className="editor-content" />
        </>
      ) : (
        <div className="editor-loading">memuat editor…</div>
      )}
      <div className="field" style={{ marginTop: 24, maxWidth: 420 }}>
        <label>Section</label>
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">(root)</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
    </div>
  );
}
