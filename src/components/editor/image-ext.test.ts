// @vitest-environment happy-dom
// src/components/editor/image-ext.test.ts
import { it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { ImageRes } from "./image-ext";

function makeEditor(md: string) {
  return new Editor({ extensions: [StarterKit, ImageRes, Markdown], contentType: "markdown", content: md });
}

function imageAttrs(e: Editor): Record<string, unknown> | null {
  let found: Record<string, unknown> | null = null;
  e.state.doc.descendants((node) => {
    if (node.type.name === "image") found = node.attrs as Record<string, unknown>;
    return true;
  });
  return found;
}

it("keeps plain images as standard markdown", () => {
  const e = makeEditor("sebelum\n\n![](a.png)\n\nsesudah");
  const md = e.getMarkdown();
  expect(md).toContain("![](a.png)");
  expect(md).not.toContain("<img");
  e.destroy();
});

it("round-trips resized image width through markdown", () => {
  const e1 = makeEditor("sebelum\n\n![](a.png)\n\nsesudah");
  let pos: number | null = null;
  e1.state.doc.descendants((node, p) => {
    if (node.type.name === "image") pos = p;
    return true;
  });
  e1.chain().setNodeSelection(pos as number).updateAttributes("image", { width: 320, height: 240 }).run();
  const md = e1.getMarkdown();
  expect(md).toContain('width="320"');
  e1.destroy();

  const e2 = makeEditor(md);
  expect(imageAttrs(e2)?.width).toBe(320);
  expect(imageAttrs(e2)?.src).toBe("a.png");
  e2.destroy();
});
