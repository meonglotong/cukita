import { it, expect, describe } from "vitest";
import { renderMarkdown, markedWithCallouts } from "./render";
import { calloutExtension } from "./callouts";

describe("xss sanitization", () => {
  it("strips script tags from html output", () => {
    const { html } = renderMarkdown("hello\n\n<script>window.__pwned=1</script>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("__pwned");
  });

  it("strips inline event handlers", () => {
    const { html } = renderMarkdown('<img src="a.png" onerror="window.__pwned=1">');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("__pwned");
    expect(html).toContain('<img src="a.png"');
  });

  it("drops javascript: URLs in links", () => {
    const { html } = renderMarkdown("[klik](javascript:window.__pwned=1)");
    expect(html).not.toContain("javascript:");
  });

  it("keeps safe markup: heading ids, links, images, callouts", () => {
    const { html } = renderMarkdown(
      '## Sub\n\n[b](https://example.com/x)\n\n![alt](/files/a.png)\n\n> [!info]\n> **tebal** di callout'
    );
    expect(html).toContain('<h2 id="sub">');
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('src="/files/a.png"');
    expect(html).toContain('class="callout callout-info"');
    expect(html).toContain("<strong>tebal</strong>");
  });

  it("sanitizes markedWithCallouts too", () => {
    expect(markedWithCallouts('<script>window.__pwned=1</script>')).not.toContain("<script");
  });
});

describe("callouts", () => {
  it("renders info/warning/danger", () => {
    expect(markedWithCallouts("> [!info]\n> A")).toContain("callout-info");
    expect(markedWithCallouts("> [!warning]\n> B")).toContain("callout-warn");
    expect(markedWithCallouts("> [!danger]\n> C")).toContain("callout-danger");
    expect(markedWithCallouts("> biasa")).not.toContain("callout-");
  });
});

describe("renderMarkdown", () => {
  it("adds ids to headings", () => {
    const { html } = renderMarkdown("## Getting Started\n\nhalo");
    expect(html).toMatch(/<h2 id="getting-started"/);
  });
  it("builds TOC from h2/h3 only", () => {
    const { toc } = renderMarkdown("# Judul\n## Satu\n### Dua\n#### Tiga");
    expect(toc).toEqual([
      { level: 2, text: "Satu", id: "satu" },
      { level: 3, text: "Dua", id: "dua" },
    ]);
  });
  it("dedupes repeated heading ids", () => {
    const { toc } = renderMarkdown("## A\n## A");
    expect(toc.map((t) => t.id)).toEqual(["a", "a-2"]);
  });
});

describe("leading H1 (page title already rendered in the doc header)", () => {
  it("strips a first-line H1 from the body", () => {
    const { html, toc } = renderMarkdown("# Panduan TimKB\n\nIsi di sini.\n\n## Sub");
    expect(html).not.toContain("<h1");
    expect(toc).toEqual([{ level: 2, text: "Sub", id: "sub" }]);
  });
  it("keeps H1s that are not at the top of the document", () => {
    const { html } = renderMarkdown("paragraf pembuka\n\n# Tengah");
    expect(html).toContain("<h1 id=\"tengah\">");
  });
});

describe("nested headings", () => {
  const htmlHeadingIds = (html: string) =>
    Array.from(html.matchAll(/<h[1-6] id="([^"]+)"/g)).map((m) => m[1]);

  it("counts a heading nested in a callout body", () => {
    const { html, toc } = renderMarkdown("> [!info]\n> ## Alpha\n\n## Alpha");
    expect(toc.map((t) => t.id)).toEqual(["alpha", "alpha-2"]);
    expect(toc.map((t) => t.id)).toEqual(htmlHeadingIds(html));
  });
  it("counts a heading nested in a blockquote", () => {
    const { html, toc } = renderMarkdown("> ## Alpha\n\n## Alpha");
    expect(toc.map((t) => t.id)).toEqual(["alpha", "alpha-2"]);
    expect(toc.map((t) => t.id)).toEqual(htmlHeadingIds(html));
  });
  it("counts a heading nested in a list item", () => {
    const { html, toc } = renderMarkdown("- ## Alpha\n\n## Alpha");
    expect(toc.map((t) => t.id)).toEqual(["alpha", "alpha-2"]);
    expect(toc.map((t) => t.id)).toEqual(htmlHeadingIds(html));
  });
});
