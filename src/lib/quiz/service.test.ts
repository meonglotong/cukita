// src/lib/quiz/service.test.ts
import { beforeAll, it, expect } from "vitest";
import { runMigrations } from "@/scripts/migrate";
import { query } from "@/lib/db";
import { recordAttempt, getBoard } from "./service";
import { fakeUserSession, fakeAdminSession } from "@/test/fixtures";

const ALICE = fakeUserSession.user.id;
const BOB = fakeAdminSession.user.id;

beforeAll(async () => {
  await runMigrations();
  for (const id of [ALICE, BOB]) {
    await query("DELETE FROM quiz_attempts WHERE user_id = $1", [id]);
    await query(
      `INSERT INTO users (id, email, name, password_hash, role) VALUES ($1, $2, $3, 'x', 'user')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [id, `quiz-${id.slice(0, 8)}@local`, id === ALICE ? "AliceQ" : "BobQ"]
    );
  }
});

it("recordAttempt stores a row with the given values", async () => {
  await recordAttempt(ALICE, "sysadmin", 16, 20, true, 900);
  const { rows } = await query(
    "SELECT score, total, passed, duration_sec, track FROM quiz_attempts WHERE user_id = $1 AND track = 'sysadmin'",
    [ALICE]
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ score: 16, total: 20, passed: true, duration_sec: 900, track: "sysadmin" });
});

it("getBoard orders users by best score descending", async () => {
  await recordAttempt(ALICE, "dba", 10, 20, false, 100);
  await recordAttempt(BOB, "dba", 18, 20, true, 100);
  await recordAttempt(ALICE, "dba", 15, 20, false, 100); // later, better, must be her board score
  const board = await getBoard("dba");
  expect(board.entries.map((e) => e.userId)).toEqual([BOB, ALICE]);
  expect(board.entries[0].bestScore).toBe(18);
  expect(board.entries[1].bestScore).toBe(15);
});

it("board shows only the best score per user", async () => {
  const { rows } = await query(
    "SELECT COUNT(*)::int AS n FROM quiz_attempts WHERE user_id = $1 AND track = 'dba'",
    [ALICE]
  );
  expect(rows[0].n).toBe(2); // two attempts exist...
  const board = await getBoard("dba");
  const alice = board.entries.find((e) => e.userId === ALICE)!;
  expect(alice.bestScore).toBe(15); // ...but board shows the best only
});

it("tie on best score: earliest time the best was reached ranks first", async () => {
  await query(
    `INSERT INTO quiz_attempts (user_id, track, score, total, passed, duration_sec, created_at)
     VALUES ($1, 'devops', 12, 20, false, 50, '2026-01-02 00:00:00+00'),
            ($2, 'devops', 12, 20, false, 50, '2026-01-01 00:00:00+00')`,
    [ALICE, BOB]
  );
  const board = await getBoard("devops");
  expect(board.entries.map((e) => e.userId)).toEqual([BOB, ALICE]);
});

it("rankOf returns 1-based position, null for users without attempts", async () => {
  const board = await getBoard("devops");
  expect(board.rankOf(BOB)).toBe(1);
  expect(board.rankOf(ALICE)).toBe(2);
  expect(board.rankOf("11111111-1111-1111-1111-111111111111")).toBeNull();
});

it("board is per-track: attempts on other tracks do not leak in", async () => {
  const board = await getBoard("sysadmin");
  expect(board.entries.every((e) => e.userId === ALICE)).toBe(true); // only alice attempted sysadmin
  expect(board.entries[0].bestScore).toBe(16);
});
