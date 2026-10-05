// src/components/DocEditor.tsx
"use client";
// The doc page itself is the editor (Notion-style): click anywhere to type,
// auto-save, no save button. Title is the big first line; rename = type.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { ImageRes } from "./editor/image-ext";
import { SlashMenu } from "./editor/SlashMenu";
import { detectSlash, type SlashState } from "./editor/slash-command";

interface ParentOption { id: string; title: string }

const SAVE_DEBOUNCE_MS = 800;

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

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (title: string, active: boolean, run: () => void, label: string) => (
    <button type="button" title={title} className={`toolbar-btn${active ? " active" : ""}`} onClick={run}>{label}</button>
  );
  return (
    <div className="editor-toolbar-row">
      {btn("Bold", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "B")}
      {btn("Italic", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "I")}
      {btn("Strikethrough", editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "S")}
      {btn("Inline code", editor.isActive("code"), () => editor.chain().focus().toggleCode().run(), "</>")}
      <span className="toolbar-sep" />
      {btn("Heading 2", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "H2")}
      {btn("Heading 3", editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "H3")}
      <span className="toolbar-sep" />
      {btn("Bullet list", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "•")}
      {btn("Numbered list", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1.")}
      {btn("To-do list", editor.isActive("taskList"), () => editor.chain().focus().toggleTaskList().run(), "☑")}
      <span className="toolbar-sep" />
      {btn("Quote", editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "❝")}
      {btn("Code block", editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run(), "{ }")}
      {btn("Divider", false, () => editor.chain().focus().setHorizontalRule().run(), "—")}
      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>/ untuk blok</span>
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
  const [status, setStatus] = useState("");
  const [slash, setSlash] = useState<SlashState | null>(null);

  // editorProps handlers run after creation, so they read the editor through a ref
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [StarterKit, ImageRes, Markdown],
    contentType: "markdown",
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

  // ---- auto-save (debounced) ----
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed) return;
    dirty.current = false;
    setStatus("menyimpan…");
    const res = await fetch(`/api/docs/${pageId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, bodyMd: ed.getMarkdown(), parentId: parentId || null }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? "gagal disimpan"); setStatus(""); return; }
    if (typeof json.slug === "string" && json.slug && json.slug !== currentSlugRef.current) {
      currentSlugRef.current = json.slug;
      window.history.replaceState(null, "", `/docs/${json.slug}`);
    }
    setStatus("tersimpan");
  }, [pageId, title, parentId]);
  const currentSlugRef = useRef<string | null>(null);

  const queueSave = useCallback(() => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(), SAVE_DEBOUNCE_MS);
  }, [saveNow]);
  // refs so stable event handlers never capture a stale save closure
  const queueSaveRef = useRef(queueSave);
  queueSaveRef.current = queueSave;
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // flush on unmount (tab close / navigation)
  useEffect(() => () => { if (dirty.current) void saveNowRef.current(); }, []);

  // ---- editor updates: autosave + slash detection ----
  const onEditorEvent = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    queueSaveRef.current();
    setSlash(detectSlash(ed));
  }, []);
  useEffect(() => {
    if (!editor) return;
    editor.on("update", onEditorEvent);
    editor.on("selectionUpdate", onEditorEvent);
    return () => {
      editor.off("update", onEditorEvent);
      editor.off("selectionUpdate", onEditorEvent);
    };
  }, [editor, onEditorEvent]);
  useEffect(() => { setTitle(initialTitle); }, [initialTitle]);
  // any title keystroke should also save
  const onTitleChange = (v: string) => { setTitle(v); queueSave(); };

  const movePage = (value: string) => {
    setParentId(value);
    void (async () => {
      const res = await fetch(`/api/docs/${pageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parentId: value || null }),
      });
      if (!res.ok) { const j = await res.json(); setMsg(j.error ?? "gagal dipindah"); }
      router.refresh();
    })();
  };

  const deletePage = async () => {
    if (!confirm("Hapus halaman ini?")) return;
    const res = await fetch(`/api/docs/${pageId}`, { method: "DELETE" });
    if (res.status === 409) { setMsg("tidak bisa dihapus: masih punya halaman anak"); return; }
    if (!res.ok) { const j = await res.json(); setMsg(j.error ?? "gagal"); return; }
    router.push("/docs");
    router.refresh();
  };

  return (
    <div className="doc-editor">
      <div className="editor-topbar">
        <span className="editor-save-status">{status}{msg ? ` — ${msg}` : ""}</span>
        <details className="page-menu">
          <summary>⋮</summary>
          <div className="menu-body">
            <div>
              <h5>Pindah ke</h5>
              <div className="row">
                <select value={parentId} onChange={(e) => movePage(e.target.value)}>
                  <option value="">(root)</option>
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </div>
            <button type="button" className="btn btn-danger" onClick={() => void deletePage()}>Hapus halaman</button>
          </div>
        </details>
      </div>
      <input
        className="doc-title-input"
        placeholder="Untitled"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
      />
      {editor ? (
        <>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} className="editor-content" />
          {slash ? (
            <SlashMenu editor={editor} slash={slash} onDone={() => setSlash(null)} />
          ) : null}
        </>
      ) : (
        <div className="editor-loading">memuat editor…</div>
      )}
    </div>
  );
}
