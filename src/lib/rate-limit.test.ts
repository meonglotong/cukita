import { it, expect } from "vitest";
import { createRateLimiter } from "./rate-limit";

it("allows up to the limit within the window", () => {
  const allow = createRateLimiter(3, 1000);
  expect(allow("a", 0)).toBe(true);
  expect(allow("a", 100)).toBe(true);
  expect(allow("a", 200)).toBe(true);
  expect(allow("a", 300)).toBe(false);
});

it("resets after the window expires", () => {
  const allow = createRateLimiter(2, 1000);
  expect(allow("a", 0)).toBe(true);
  expect(allow("a", 100)).toBe(true);
  expect(allow("a", 200)).toBe(false);
  expect(allow("a", 1100)).toBe(true);
  expect(allow("a", 1200)).toBe(true);
  expect(allow("a", 1300)).toBe(false);
});

it("tracks keys independently", () => {
  const allow = createRateLimiter(1, 1000);
  expect(allow("a", 0)).toBe(true);
  expect(allow("b", 0)).toBe(true);
  expect(allow("a", 100)).toBe(false);
});
