// src/lib/db.test.ts
import { beforeAll, it, expect } from "vitest";
import { query, closePool } from "./db";
import { runMigrations } from "../scripts/migrate";

beforeAll(async () => { await runMigrations(); });

it("creates all four tables", async () => {
  const { rows } = await query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','doc_pages','files','file_versions')"
  );
  expect(rows.length).toBe(4);
});
