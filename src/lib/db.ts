// src/lib/db.ts
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pg.types.setTypeParser(20, (v) => Number(v)); // int8 -> number

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export function closePool(): Promise<void> {
  return pool.end();
}
