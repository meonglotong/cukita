// src/lib/matchers.test.ts
import { it, expect } from "vitest";
import { isProtected } from "./matchers";

it("protects app areas", () => {
  expect(isProtected("/docs")).toBe(true);
  expect(isProtected("/docs/api")).toBe(true);
  expect(isProtected("/files")).toBe(true);
  expect(isProtected("/admin/users")).toBe(true);
});
it("lets login and static assets through", () => {
  expect(isProtected("/login")).toBe(false);
  expect(isProtected("/api/auth/callback/credentials")).toBe(false);
});
