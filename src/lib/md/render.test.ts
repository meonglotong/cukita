import { it, expect, describe } from "vitest";
import { renderMarkdown, markedWithCallouts } from "./render";
import { calloutExtension } from "./callouts";

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
