// src/lib/users/service.test.ts
import { beforeAll, it, expect } from "vitest";
import { runMigrations } from "../../scripts/migrate";
import { query } from "../db";
import { hashPassword } from "../password";
import { changePassword } from "./service";

let userId: string;

beforeAll(async () => {
  await runMigrations();
  await query("DELETE FROM users WHERE email = 'pw@test.local'");
  const { rows } = await query(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES ('pw@test.local', 'PwTest', $1, 'user') RETURNING id`,
    [await hashPassword("oldpass123")]
  );
  userId = rows[0].id;
});

it("rejects a wrong current password (WRONG_PASSWORD)", async () => {
  await expect(changePassword(userId, "salah123", "newpass456")).rejects.toMatchObject({ code: "WRONG_PASSWORD" });
});

it("rejects a new password shorter than 8 chars (TOO_SHORT)", async () => {
  await expect(changePassword(userId, "oldpass123", "pendek")).rejects.toMatchObject({ code: "TOO_SHORT" });
});

it("changes the password and the new one verifies", async () => {
  await changePassword(userId, "oldpass123", "newpass456");
  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [userId]);
  const { verifyPassword } = await import("../password");
  expect(await verifyPassword(rows[0].password_hash, "newpass456")).toBe(true);
  expect(await verifyPassword(rows[0].password_hash, "oldpass123")).toBe(false);
});
