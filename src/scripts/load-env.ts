// src/scripts/load-env.ts
// tsx scripts don't load .env.local like Next.js does. This module is a
// side-effect import (must come BEFORE any ../lib/db import in a script)
// that fills missing env vars from .env.local so scripts work standalone.
// Real environment always wins (vars already set are never overridden).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  const file = path.join(process.cwd(), ".env.local");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
}

export {};
