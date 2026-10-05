// src/components/editor/image-ext.ts
import Image, { type ImageOptions } from "@tiptap/extension-image";
import type { JSONContent } from "@tiptap/core";

// Notion-style resize: drag the bottom-right handle (aspect ratio locked).
// The official renderMarkdown drops width/height, so resized images would
// lose their size on save. Resized images are exported as <img> tags with
// width/height attributes — @tiptap/markdown re-parses those through
// ProseMirror's DOMParser (html-token path), so the size round-trips.
// Untouched images stay as standard markdown `![alt](src)`.
export const ImageRes = Image.extend({
  addOptions(): ImageOptions {
    const parent = this.parent?.();
    return {
      inline: parent?.inline ?? false,
      allowBase64: parent?.allowBase64 ?? false,
      HTMLAttributes: parent?.HTMLAttributes ?? {},
      // Note: the Image node view styles its handle via
      // [data-resize-wrapper]/[data-resize-handle] — see globals.css.
      resize: {
        enabled: true,
        directions: ["bottom-right"],
        minWidth: 80,
        alwaysPreserveAspectRatio: true,
      },
    };
  },
  renderMarkdown(node: JSONContent, _helpers?: unknown, _ctx?: unknown) {
    const attrs = (node.attrs ?? {}) as { src?: string | null; alt?: string | null; title?: string | null; width?: number | string | null; height?: number | string | null };
    const src = attrs.src ?? "";
    const alt = attrs.alt ?? "";
    const title = attrs.title ?? "";
    const { width, height } = attrs;
    if (width == null && height == null) {
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
    }
    const w = width != null ? ` width="${width}"` : "";
    const h = height != null ? ` height="${height}"` : "";
    return `<img src="${src}" alt="${alt}"${w}${h}>`;
  },
});
