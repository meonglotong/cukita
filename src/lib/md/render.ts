import { Marked } from "marked";
import type { Token, Tokens } from "marked";
import { slugify } from "./slugify";
import { calloutExtension, type CalloutToken } from "./callouts";

export interface TocItem { level: 2 | 3; text: string; id: string }

const marked = new Marked({ gfm: true, breaks: false });

// Base id from the heading text; "" (empty heading) falls back to "section".
function headingBase(text: string): string {
  return slugify(text) || "section";
}

// GitHub-style dedup: first occurrence keeps the base, later ones get -2, -3…
// Each caller passes its own counter, so the TOC pass and the renderer pass
// both compute the identical id sequence without sharing mutable state.
function dedupedId(base: string, counts: Map<string, number>): string {
  const n = counts.get(base) ?? 0;
  counts.set(base, n + 1);
  return n === 0 ? base : `${base}-${n + 1}`;
}

// Module-level counter, advanced by the heading renderer exactly once per
// renderMarkdown() call (reset below).
const renderedCounts = new Map<string, number>();

marked.use(calloutExtension);

// marked v16 has no getRenderer(); heading ids are injected through a
// renderer override that feeds the same counter the TOC pass mirrors.
marked.use({
  renderer: {
    heading(token: Tokens.Heading): string {
      const id = dedupedId(headingBase(token.text), renderedCounts);
      const html = this.parser.parseInline(token.tokens);
      return `<h${token.depth} id="${id}">${html}</h${token.depth}>\n`;
    },
  },
});

export function renderMarkdown(md: string): { html: string; toc: TocItem[] } {
  renderedCounts.clear();
  const toc: TocItem[] = [];
  const tocCounts = new Map<string, number>();
  // Mirror the renderer's id assignment in document order (every heading
  // consumes a counter slot, including headings nested in blockquotes, list
  // items, and callout bodies) so TOC ids always match the emitted html ids.
  forEachHeading(marked.lexer(md), (heading) => {
    const id = dedupedId(headingBase(heading.text), tocCounts);
    if (heading.depth === 2 || heading.depth === 3) {
      toc.push({ level: heading.depth as 2 | 3, text: heading.text, id });
    }
  });
  return { html: marked.parse(md, { async: false }) as string, toc };
}

export function markedWithCallouts(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

// Visit every heading token in document order, recursing into exactly the
// containers marked's parser recurses into when rendering (blockquote and
// list children, and re-lexed callout bodies).
function forEachHeading(tokens: Token[], visit: (heading: Tokens.Heading) => void): void {
  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        visit(token as Tokens.Heading);
        break;
      case "blockquote":
        forEachHeading((token as Tokens.Blockquote).tokens, visit);
        break;
      case "list":
        for (const item of (token as Tokens.List).items) {
          forEachHeading(item.tokens, visit);
        }
        break;
      case "callout":
        forEachHeading(marked.lexer((token as CalloutToken).body), visit);
        break;
    }
  }
}
