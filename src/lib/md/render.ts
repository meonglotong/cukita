import { Marked } from "marked";
import type { Token, Tokens } from "marked";
import sanitizeHtml from "sanitize-html";
import { slugify } from "./slugify";
import { calloutExtension, type CalloutToken } from "./callouts";

export interface TocItem { level: 2 | 3; text: string; id: string }

const marked = new Marked({ gfm: true, breaks: false });

// Docs are written by users and rendered into other users' browsers, so the
// html output goes through a strict allowlist: only the tags/attributes the
// renderer itself emits (plus raw HTML a user pasted in, with scripts,
// event handlers, and non-http(s) schemes stripped).
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "strong", "em", "del",
    "a", "ul", "ol", "li", "blockquote", "pre", "code",
    "table", "thead", "tbody", "tr", "th", "td",
    "hr", "img", "div", "span",
  ],
  allowedAttributes: {
    a: ["href", "title"],
    img: ["src", "alt", "width", "height"],
    h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"], h5: ["id"], h6: ["id"],
    code: ["class"],
    div: ["class"],
    span: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
};

function sanitize(mdHtml: string): string {
  return sanitizeHtml(mdHtml, SANITIZE_OPTIONS);
}

// Base id from the heading text; "" (empty heading) falls back to "section".
function headingBase(text: string): string {
  return slugify(text) || "section";
}

// Clean, readable text of a heading's inline content (emphasis, code spans,
// links → their text). Used for TOC entries: the raw heading text may carry
// markdown syntax like `**bold**`, which looks ugly in the TOC and breaks
// the client-side text match that scrolls to the heading. slugify strips
// the same punctuation, so ids computed from raw text stay identical.
function inlineText(inline: Tokens.InlineToken[]): string {
  let out = "";
  for (const t of inline) {
    switch (t.type) {
      case "text":
        out += (t as Tokens.Text).text;
        break;
      case "codespan":
        out += (t as Tokens.Codespan).text;
        break;
      case "br":
        out += " ";
        break;
      case "em":
      case "strong":
      case "del":
        out += inlineText((t as Tokens.Em | Tokens.Strong | Tokens.Del).tokens);
        break;
      case "link":
        out += inlineText((t as Tokens.Link).tokens);
        break;
      default:
        break;
    }
  }
  return out;
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

// The doc header already renders page.title as the h1, so a first-line
// "# Title" in the body would duplicate it (GitBook-style stripping).
// Only the very first heading of the document is removed; H1s later in
// the body are kept.
function stripLeadingH1(md: string): string {
  return md.replace(/^\s*#[ \t]+[^\n]*\r?\n/, "");
}

export function renderMarkdown(md: string): { html: string; toc: TocItem[] } {
  const body = stripLeadingH1(md);
  renderedCounts.clear();
  const toc: TocItem[] = [];
  const tocCounts = new Map<string, number>();
  // Mirror the renderer's id assignment in document order (every heading
  // consumes a counter slot, including headings nested in blockquotes, list
  // items, and callout bodies) so TOC ids always match the emitted html ids.
  forEachHeading(marked.lexer(body), (heading) => {
    const id = dedupedId(headingBase(heading.text), tocCounts);
    if (heading.depth === 2 || heading.depth === 3) {
      toc.push({ level: heading.depth as 2 | 3, text: inlineText(heading.tokens), id });
    }
  });
  return { html: sanitize(marked.parse(body, { async: false }) as string), toc };
}

export function markedWithCallouts(md: string): string {
  return sanitize(marked.parse(md, { async: false }) as string);
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
