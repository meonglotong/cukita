// vitest.setup.ts
import pg from "pg";
import { afterAll } from "vitest";

// This happy-dom version does not expose localStorage; provide a minimal
// in-memory shim so client-component tests can exercise it.
if (typeof window !== "undefined" && window.localStorage === undefined) {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
}

const base = new pg.Client({ connectionString: "postgres://mac@localhost/postgres?host=/tmp" });
await base.connect();
const { rows } = await base.query("SELECT 1 FROM pg_database WHERE datname = 'teamkb_test'");
if (rows.length === 0) {
  try {
    await base.query("CREATE DATABASE teamkb_test");
  } catch (e) {
    const code = (e as { code?: string }).code;
    // another worker won the race: 42P07 = duplicate_database; 23505 = unique_violation on pg_database_datname_index (observed under true concurrency)
    if (code !== "42P07" && code !== "23505") throw e;
  }
}
await base.end();

process.env.DATABASE_URL = "postgres://mac@localhost/teamkb_test?host=/tmp";

afterAll(async () => {
  const { closePool } = await import("@/lib/db");
  await closePool();
});
