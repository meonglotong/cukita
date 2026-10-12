// src/app/api/quiz/submit/route.ts
// POST /api/quiz/submit — grade server-side, persist the attempt, return score + rank.
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { getTrack } from "@/lib/quiz/bank";
import { grade } from "@/lib/quiz/grade";
import { recordAttempt, getBoard } from "@/lib/quiz/service";

export async function POST(req: Request) {
  const g = await requireAuth();
  if ("status" in g) return NextResponse.json({ error: "login required" }, { status: 401 });

  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const b = body as { track?: unknown; answers?: unknown; durationSec?: unknown };

  const track = getTrack(String(b.track ?? ""));
  if (!track) return NextResponse.json({ error: "track tidak dikenal" }, { status: 400 });

  const answers: Record<string, number> = {};
  const questionIds = new Set(track.questions.map((q) => q.id));
  const rawAnswers = (typeof b.answers === "object" && b.answers !== null ? b.answers : {}) as Record<string, unknown>;
  for (const [qid, v] of Object.entries(rawAnswers)) {
    if (!questionIds.has(qid) || typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 3) {
      return NextResponse.json({ error: "jawaban tidak valid" }, { status: 400 });
    }
    answers[qid] = v;
  }

  const durationSec = typeof b.durationSec === "number" && Number.isInteger(b.durationSec) && b.durationSec >= 0
    ? Math.min(b.durationSec, track.durationSec)
    : 0;

  // The server grades; the client's own grade is display-only.
  const result = grade(track.questions, answers, track.passingPercent);
  await recordAttempt(g.session.user.id, track.slug, result.score, result.total, result.passed, durationSec);
  const board = await getBoard(track.slug);

  return NextResponse.json({
    score: result.score,
    total: result.total,
    percent: result.percent,
    passed: result.passed,
    rank: board.rankOf(g.session.user.id),
    top: board.entries.slice(0, 10),
  });
}
