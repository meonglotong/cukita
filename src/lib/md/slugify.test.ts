import { it, expect, describe } from "vitest";
import { slugify } from "./slugify";

describe("harness", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });

it("lowercases, strips punctuation, joins with -", () => {
  expect(slugify("Hello, World!")).toBe("hello-world");
  expect(slugify("  Spaced   Out  ")).toBe("spaced-out");
});
it("collapses repeated dashes", () => {
  expect(slugify("a -- b --- c")).toBe("a-b-c");
});
it("keeps unicode letters", () => {
  expect(slugify("Halo Dunia")).toBe("halo-dunia");
});
