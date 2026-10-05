import { it, expect } from "vitest";
import { markedWithCallouts } from "./render";

it("detects [!info] blockquote", () => {
  const md = "> [!info]\n> Catatan penting";
  const html = markedWithCallouts(md);
  expect(html).toContain('class="callout callout-info"');
  expect(html).toContain("Catatan penting");
});

it("detects [!warning] and [!danger]", () => {
  expect(markedWithCallouts("> [!warning]\n> Hati-hati")).toContain("callout-warn");
  expect(markedWithCallouts("> [!danger]\n> Bahaya")).toContain("callout-danger");
});

it("plain blockquote is untouched", () => {
  expect(markedWithCallouts("> biasa aja")).not.toContain("callout-");
});
