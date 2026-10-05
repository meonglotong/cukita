// src/scripts/migrate.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { closePool } from "../lib/db";

const MIGRATE_LOCK = "teamdocs_migrate";

export async function runMigrations(): Promise<void> {
  const sql = readFileSync(
    path.join(import.meta.dirname, "..", "lib", "schema.sql"),
    "utf8"
  );
  // Serialize concurrent DDL (e.g. parallel vitest workers running
  // runMigrations at once) on one dedicated session, so the advisory lock
  // and the DDL statements share the same connection.
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`SELECT pg_advisory_lock(hashtext($1)::bigint)`, [MIGRATE_LOCK]);
    try {
      await client.query(sql);
    } finally {
      await client.query(`SELECT pg_advisory_unlock(hashtext($1)::bigint)`, [MIGRATE_LOCK]);
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] === import.meta.url.replace("file://", "")) {
  runMigrations()
    .then(() => { console.log("migrations ok"); return closePool(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
