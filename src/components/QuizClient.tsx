// src/components/QuizClient.tsx
// CBT-style exam engine: briefing → timed quiz (nav + palette) → instant
// score with per-question review. Score persisted server-side on submit.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { grade } from "@/lib/quiz/grade";
import type { BoardEntry } from "@/lib/quiz/service";
import type { QuizTrack } from "@/lib/quiz/types";
import { Leaderboard } from "./Leaderboard";

interface ServerResult {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  rank: number | null;
  top: BoardEntry[];
}

type Phase = "briefing" | "running" | "results";

const LETTERS = ["A", "B", "C", "D"];

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} jam ${m % 60} menit` : `${m} menit`;
}

export function QuizClient({ track }: { track: QuizTrack }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("briefing");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [result, setResult] = useState<ServerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const remainingSec =
    phase === "running" && deadline > 0
      ? Math.max(0, Math.ceil((deadline - nowMs) / 1000))
      : track.durationSec;

  const start = () => {
    setAnswers({});
    setCurrent(0);
    setNowMs(Date.now());
    setDeadline(Date.now() + track.durationSec * 1000);
    setSubmitError("");
    setResult(null);
    submittedRef.current = false;
    setPhase("running");
  };

  const submit = async (snapshot: Record<string, number>) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          track: track.slug,
          answers: snapshot,
          questionIds: track.questions.map((q) => q.id),
          durationSec: track.durationSec,
        }),
      });
      const json: ServerResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(json.error ?? "gagal mengirim jawaban");
      setResult(json);
      setPhase("results");
    } catch (e) {
      submittedRef.current = false;
      setSubmitError(e instanceof Error ? e.message : "gagal mengirim jawaban");
    } finally {
      setSubmitting(false);
    }
  };

  // Ticking clock + auto-submit when time runs out.
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      const n = Date.now();
      setNowMs(n);
      if (deadline > 0 && n >= deadline) void submit(answersRef.current);
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline]);

  const answeredCount = Object.keys(answers).length;
  const clientGrade = useMemo(
    () => (result ? grade(track.questions, answers, track.passingPercent) : null),
    [result, answers, track]
  );

  if (phase === "briefing") {
    return (
      <div className="quiz-brief">
        <h1 className="quiz-title">{track.title}</h1>
        <p className="quiz-desc">{track.description}</p>
        <ul className="quiz-rules">
          <li>{track.questions.length} soal pilihan ganda (4 opsi)</li>
          <li>Waktu: {fmtDuration(track.durationSec)} — ujian berhenti otomatis saat waktu habis</li>
          <li>Passing line: {track.passingPercent}%</li>
          <li>Boleh navigasi antar soal sebelum submit</li>
          <li>Setelah submit: nilai langsung + review semua jawaban</li>
        </ul>
        <button type="button" className="btn btn-primary quiz-start" onClick={start}>
          Mulai Ujian
        </button>
      </div>
    );
  }

  if (phase === "running") {
    const q = track.questions[current];
    return (
      <div className="quiz-run">
        <div className="quiz-run-top">
          <div>
            <h2 className="quiz-title-sm">{track.title}</h2>
            <span className="quiz-progress">
              Soal {current + 1} / {track.questions.length} · {answeredCount} terjawab
            </span>
          </div>
          <div className={`quiz-timer${remainingSec <= 60 ? " quiz-timer-low" : ""}`}>{fmtClock(remainingSec)}</div>
        </div>

        {submitError ? (
          <div className="quiz-err">
            <span>{submitError}</span>
            <button type="button" className="btn" disabled={submitting} onClick={() => void submit(answersRef.current)}>
              Coba lagi
            </button>
          </div>
        ) : null}

        <div className="quiz-paper">
          <p className="quiz-prompt">{q.prompt}</p>
          <div className="quiz-options">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                className={`quiz-option${answers[q.id] === i ? " selected" : ""}`}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
              >
                <span className="quiz-option-letter">{LETTERS[i]}</span>
                <span className="quiz-option-text">{opt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-nav">
          <button type="button" className="btn" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
            ← Sebelumnya
          </button>
          <div className="quiz-palette">
            {track.questions.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`quiz-palette-btn${i === current ? " current" : ""}${answers[track.questions[i].id] !== undefined ? " answered" : ""}`}
                title={`Soal ${i + 1}`}
                onClick={() => setCurrent(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="quiz-nav-right">
            {current < track.questions.length - 1 ? (
              <button type="button" className="btn" onClick={() => setCurrent((c) => c + 1)}>
                Berikutnya →
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting}
              onClick={() => {
                if (answeredCount < track.questions.length && !window.confirm(`Masih ada ${track.questions.length - answeredCount} soal belum dijawab. Tetap submit?`)) return;
                void submit(answersRef.current);
              }}
            >
              {submitting ? "Mengirim…" : "Selesai & Kumpulkan"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === "results"
  if (!result || !clientGrade) return null;
  return (
    <div className="quiz-results">
      <div className={`quiz-verdict ${result.passed ? "pass" : "fail"}`}>
        <span className="quiz-verdict-label">{result.passed ? "LULUS" : "TIDAK LULUS"}</span>
        <span className="quiz-verdict-score">{result.percent}%</span>
        <p className="quiz-verdict-sub">
          {result.score} dari {result.total} benar · passing line {track.passingPercent}%
          {result.rank ? ` · Rank kamu: #${result.rank}` : ""}
        </p>
      </div>

      <Leaderboard title={`Papan Skor — ${track.title}`} entries={result.top} limit={10} />

      <h3 className="quiz-review-title">Review Jawaban</h3>
      <div className="quiz-review">
        {track.questions.map((q, qi) => {
          const g = clientGrade.questions.find((x) => x.questionId === q.id)!;
          return (
            <div key={q.id} className={`quiz-review-item ${g.isCorrect ? "ok" : "wrong"}`}>
              <p className="quiz-review-prompt">
                <span className={`quiz-review-mark ${g.isCorrect ? "ok" : "wrong"}`}>{g.isCorrect ? "✓" : "✗"}</span>{" "}
                {qi + 1}. {q.prompt}
              </p>
              <div className="quiz-review-options">
                {q.options.map((opt, i) => (
                  <div
                    key={i}
                    className={`quiz-review-option ${i === g.correctIndex ? "correct" : ""} ${g.chosen === i && i !== g.correctIndex ? "chosen-wrong" : ""}`}
                  >
                    <span className="quiz-option-letter">{LETTERS[i]}</span>
                    <span className="quiz-option-text">
                      {opt}
                      {g.chosen === i ? " — jawabanmu" : i === g.correctIndex ? " — jawaban benar" : ""}
                    </span>
                    <span className="quiz-review-exp">{q.explanations[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="quiz-results-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            router.push(`/test/${track.slug}?r=${Math.random().toString(36).slice(2)}`)
          }
        >
          Kerjakan Lagi (soal baru)
        </button>
        <Link className="btn" href="/test">Pilih Track Lain</Link>
      </div>
    </div>
  );
}
