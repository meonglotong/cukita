// src/lib/quiz/service.ts
// Persistence + leaderboard for quiz attempts.
import { query } from "../db";

export interface BoardEntry {
  userId: string;
  name: string;
  bestScore: number;
  total: number;
  // ISO time the best score was first reached (tiebreak for the board).
  atBest: string;
}

export interface Board {
  // Ordered: best score desc, then earliest first-achieved wins ties.
  entries: BoardEntry[];
  rankOf: (userId: string) => number | null; // 1-based, null if no attempt
}

export async function recordAttempt(
  userId: string,
  track: string,
  score: number,
  total: number,
  passed: boolean,
  durationSec: number
): Promise<void> {
  await query(
    `INSERT INTO quiz_attempts (user_id, track, score, total, passed, duration_sec)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, track, score, total, passed, durationSec]
  );
}

export async function getBoard(track: string): Promise<Board> {
  const { rows } = await query(
    `SELECT b.user_id, b.best_score, MAX(a.total) AS total, MIN(a.created_at) AS at_best
     FROM (
       SELECT user_id, MAX(score) AS best_score
       FROM quiz_attempts
       WHERE track = $1
       GROUP BY user_id
     ) b
     JOIN quiz_attempts a
       ON a.user_id = b.user_id AND a.track = $1 AND a.score = b.best_score
     GROUP BY b.user_id, b.best_score
     ORDER BY b.best_score DESC, at_best ASC`,
    [track]
  );

  const ids = rows.map((r) => r.user_id as string);
  const names: Record<string, string> = {};
  if (ids.length > 0) {
    const { rows: users } = await query("SELECT id, name FROM users WHERE id = ANY($1)", [ids]);
    for (const u of users) names[u.id] = u.name;
  }

  const entries: BoardEntry[] = rows.map((r, i) => ({
    userId: r.user_id,
    name: names[r.user_id] ?? "—",
    bestScore: r.best_score,
    total: r.total,
    atBest: (r.at_best as Date).toISOString(),
  }));

  const rank: Record<string, number> = {};
  entries.forEach((e, i) => { rank[e.userId] = i + 1; });

  return { entries, rankOf: (userId: string) => rank[userId] ?? null };
}
