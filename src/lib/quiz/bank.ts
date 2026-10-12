// src/lib/quiz/bank.ts
// Static certification-style question bank. JSON files live in content/quiz/
// next to the tutorial content so questions can be edited without code changes.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { QuizQuestion, QuizTrack } from "./types";

function fail(file: string, problem: string): never {
  throw new Error(`invalid quiz bank ${file}: ${problem}`);
}

function asString(v: unknown, file: string, field: string): string {
  if (typeof v !== "string" || v.trim() === "") fail(file, `${field} must be a non-empty string`);
  return v;
}

function asInt(v: unknown, file: string, field: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max)
    fail(file, `${field} must be an integer in [${min}, ${max}]`);
  return v;
}

function validateQuestion(q: unknown, file: string): QuizQuestion {
  const r = q as Record<string, unknown>;
  const id = asString(r.id, file, "id");
  const prompt = asString(r.prompt, file, `${id}: prompt`);
  if (!Array.isArray(r.options) || r.options.length !== 4) fail(file, `${id}: options must have exactly 4 entries`);
  r.options.forEach((o, i) => asString(o, file, `${id}: options[${i}]`));
  const correctIndex = asInt(r.correctIndex, file, `${id}: correctIndex`, 0, 3);
  if (!Array.isArray(r.explanations) || r.explanations.length !== 4) fail(file, `${id}: explanations must have exactly 4 entries`);
  r.explanations.forEach((e, i) => asString(e, file, `${id}: explanations[${i}]`));
  return {
    id,
    prompt,
    options: r.options as [string, string, string, string],
    correctIndex,
    explanations: r.explanations as [string, string, string, string],
  };
}

// Fisher–Yates partial shuffle: return `size` distinct items from `pool`.
// `rng` is injectable so tests can be deterministic.
export function sampleQuestions<T>(pool: T[], size: number, rng: () => number = Math.random): T[] {
  if (size >= pool.length) return [...pool];
  const a = [...pool];
  for (let i = a.length - 1; i > a.length - size; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, size);
}

export function loadTracksFromDir(dir: string): QuizTrack[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw: unknown = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
      const r = raw as Record<string, unknown>;
      const slug = asString(r.slug, f, "slug");
      if (slug !== path.basename(f, ".json")) fail(f, "slug must match the filename");
      if (!Array.isArray(r.questions)) fail(f, "questions must be an array");
      const questions = r.questions.map((q) => validateQuestion(q, f));
      const ids = new Set(questions.map((q) => q.id));
      if (ids.size !== questions.length) fail(f, "question ids must be unique");
      const examSize = asInt(r.examSize, f, "examSize", 1, 500);
      if (examSize > questions.length) fail(f, "examSize cannot exceed the question pool");
      return {
        slug,
        title: asString(r.title, f, "title"),
        description: asString(r.description, f, "description"),
        durationSec: asInt(r.durationSec, f, "durationSec", 60, 7200),
        passingPercent: asInt(r.passingPercent, f, "passingPercent", 0, 100),
        examSize,
        questions,
      } satisfies QuizTrack;
    });
}

export function loadTracks(): QuizTrack[] {
  return loadTracksFromDir(path.join(process.cwd(), "content", "quiz"));
}

export function getTrack(slug: string): QuizTrack | null {
  return loadTracks().find((t) => t.slug === slug) ?? null;
}
