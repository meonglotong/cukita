// src/components/DocEditor.tsx
"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";

// Upload a pasted/dropped image, then insert it at the cursor.
async function uploadAndInsert(file: File, editor: Editor, setStatus: (s: string) => void) {
  setStatus("mengunggah gambar…");
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) { setStatus(json.error ?? "gagal mengunggah gambar"); return; }
    editor.chain().focus().setImage({ src: json.url, alt: file.name }).run();
    setStatus("");
  } catch {
    setStatus("gagal mengunggah gambar");
  }
}

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
  const [status, setStatus] = useState("");

  // editorProps handlers run after creation, so they read the editor through a ref
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [StarterKit, Image, Markdown],
    content: initialBody,
    onCreate: ({ editor: e }) => { editorRef.current = e; },
    editorProps: {
      handlePaste: (_view, event) => {
        const ed = editorRef.current;
        if (!ed) return false;
        const files = Array.from(event.clipboardData?.items ?? [])
          .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
          .map((i) => i.getAsFile())
          .filter((f): f is File => f !== null);
        if (files.length === 0) return false;
        event.preventDefault();
        void Promise.all(files.map((f) => uploadAndInsert(f, ed, setStatus)));
        return true;
      },
      handleDrop: (_view, event) => {
        const ed = editorRef.current;
        if (!ed) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void Promise.all(files.map((f) => uploadAndInsert(f, ed, setStatus)));
        return true;
      },
    },
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
        <span className="editor-save-status">{status}</span>
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
