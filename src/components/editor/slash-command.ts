// src/components/editor/slash-command.ts
import type { Editor } from "@tiptap/core";

export interface SlashState {
  query: string;
  range: { from: number; to: number };
  coords: { top: number; left: number };
}

export interface SlashItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  keywords: string[];
  run: (editor: Editor, range: { from: number; to: number }) => void;
}

// Notion-style: "/" at line start (or after whitespace) opens the block menu,
// text after the slash filters the items.
export function detectSlash(editor: Editor): SlashState | null {
  const { from } = editor.state.selection;
  if (from !== editor.state.selection.to) return null;
  const lineStart = editor.state.selection.$from.start();
  const text = editor.state.doc.textBetween(lineStart, from, "\n");
  const m = text.match(/(?:^|\s)\/([^\s/]*)$/);
  if (!m || m.index == null) return null;
  const rangeFrom = lineStart + m.index + 1;
  const coords = editor.view.coordsAtPos(from);
  return { query: m[1], range: { from: rangeFrom, to: from }, coords };
}

export const SLASH_ITEMS: SlashItem[] = [
  { id: "h2", title: "Heading 2", desc: "Judul besar", icon: "H2", keywords: ["heading", "title", "judul", "h2"], run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 2 }).run() },
  { id: "h3", title: "Heading 3", desc: "Judul kecil", icon: "H3", keywords: ["heading", "judul", "h3"], run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 3 }).run() },
  { id: "bullet", title: "Bullet list", desc: "Daftar poin", icon: "•", keywords: ["list", "bulleted", "daftar"], run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { id: "numbered", title: "Numbered list", desc: "Daftar bernomor", icon: "1.", keywords: ["list", "numbered", "nomor"], run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { id: "todo", title: "To-do list", desc: "Daftar tugas", icon: "☑", keywords: ["todo", "task", "tugas", "cek"], run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { id: "quote", title: "Quote", desc: "Kutipan", icon: "❝", keywords: ["quote", "kutip", "block"], run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { id: "code", title: "Code block", desc: "Blok kode", icon: "{ }", keywords: ["code", "kode", "blok"], run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  {
    id: "divider", title: "Divider", desc: "Pemisah", icon: "—", keywords: ["divider", "separator", "garis", "pemisah"],
    run: (editor, r) => editor.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
  {
    id: "image", title: "Image", desc: "Sisipkan gambar", icon: "🖼", keywords: ["image", "gambar", "foto", "picture"],
    run: (editor, r) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) return;
        editor.chain().focus().deleteRange(r).setImage({ src: json.url, alt: file.name }).run();
      };
      input.click();
    },
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((i) => i.title.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q)));
}
