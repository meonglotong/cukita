// src/app/api/quiz/submit/route.test.ts
import { beforeAll, it, expect, vi } from "vitest";
import { runMigrations } from "@/scripts/migrate";
import { query } from "@/lib/db";
import { POST } from "./route";
import { fakeUserSession } from "@/test/fixtures";
import { getTrack } from "@/lib/quiz/bank";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

const ME = fakeUserSession.user.id;

function post(body: unknown): Promise<Response> {
  return POST(new Request("http://t/api/quiz/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeAll(async () => {
  await runMigrations();
  globalThis.__TEST_SESSION__ = fakeUserSession;
  await query("DELETE FROM quiz_attempts WHERE user_id = $1", [ME]);
  await query(
    `INSERT INTO users (id, email, name, password_hash, role) VALUES ($1, 'quiz-submit@local', 'Submitty', 'x', 'user')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [ME]
  );
});

it("401 without session", async () => {
  globalThis.__TEST_SESSION__ = null;
  const res = await post({ track: "sysadmin", answers: {} });
  expect(res.status).toBe(401);
});

it("400 for unknown track", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await post({ track: "quantum", answers: {} });
  expect(res.status).toBe(400);
});

it("400 for an answer on an unknown question", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await post({ track: "sysadmin", answers: { "nope": 1 } });
  expect(res.status).toBe(400);
});

it("400 for an out-of-range option index", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const track = getTrack("sysadmin")!;
  const res = await post({ track: "sysadmin", answers: { [track.questions[0].id]: 7 } });
  expect(res.status).toBe(400);
});

it("200: records the server-graded score and returns rank + top", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const track = getTrack("sysadmin")!;
  // Answer the first 10 questions correctly, leave the rest unanswered → 10/20 = 50%.
  const answers: Record<string, number> = {};
  for (const q of track.questions.slice(0, 10)) answers[q.id] = q.correctIndex;
  const res = await post({ track: "sysadmin", answers, durationSec: 1234 });
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.score).toBe(10);
  expect(json.total).toBe(20);
  expect(json.percent).toBe(50);
  expect(json.passed).toBe(false);
  expect(json.rank).toBe(1);
  expect(json.top).toHaveLength(1);
  expect(json.top[0].name).toBe("Submitty");

  const { rows } = await query(
    "SELECT score, total, passed, duration_sec FROM quiz_attempts WHERE user_id = $1 AND track = 'sysadmin'",
    [ME]
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ score: 10, total: 20, passed: false, duration_sec: 1234 });
});
