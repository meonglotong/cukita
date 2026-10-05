// vitest.setup.ts
import pg from "pg";
import { afterAll } from "vitest";

const base = new pg.Client({ connectionString: "postgres://mac@localhost/postgres?host=/tmp" });
await base.connect();
const { rows } = await base.query("SELECT 1 FROM pg_database WHERE datname = 'teamdocs_test'");
if (rows.length === 0) {
  try {
    await base.query("CREATE DATABASE teamdocs_test");
  } catch (e) {
    const code = (e as { code?: string }).code;
    // another worker won the race: 42P07 = duplicate_database; 23505 = unique_violation on pg_database_datname_index (observed under true concurrency)
    if (code !== "42P07" && code !== "23505") throw e;
  }
}
await base.end();

process.env.DATABASE_URL = "postgres://mac@localhost/teamdocs_test?host=/tmp";
process.env.FILES_DIR = process.env.FILES_DIR || `${process.cwd()}/.data/test-files`;

afterAll(async () => {
  const { closePool } = await import("@/lib/db");
  await closePool();
});
