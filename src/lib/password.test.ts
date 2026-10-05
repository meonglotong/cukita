import { it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

it("round-trips a password", async () => {
  const hash = await hashPassword("rahasia-123");
  expect(hash.startsWith("$argon2id$")).toBe(true);
  await expect(verifyPassword(hash, "rahasia-123")).resolves.toBe(true);
});

it("rejects a wrong password", async () => {
  const hash = await hashPassword("rahasia-123");
  await expect(verifyPassword(hash, "salah")).resolves.toBe(false);
});
