// src/lib/quiz/bank.test.ts
import { it, expect } from "vitest";
import { loadTracks, getTrack, sampleQuestions } from "./bank";

it("loads all three tracks sorted by slug", () => {
  const tracks = loadTracks();
  expect(tracks.map((t) => t.slug)).toEqual(["dba", "devops", "sysadmin"]);
});

it("every track has sane meta", () => {
  for (const t of loadTracks()) {
    expect(t.title).toBeTruthy();
    expect(t.description).toBeTruthy();
    expect(t.durationSec).toBeGreaterThan(0);
    expect(t.passingPercent).toBeGreaterThanOrEqual(0);
    expect(t.passingPercent).toBeLessThanOrEqual(100);
    // Contract: each track ships a 100-question pool; the exam draws 60 randomly.
    expect(t.questions.length).toBeGreaterThanOrEqual(100);
    expect(t.examSize).toBe(60);
    expect(t.examSize).toBeLessThanOrEqual(t.questions.length);
    expect(t.durationSec).toBeGreaterThanOrEqual(t.examSize * 30); // >=30s per question
  }
});

it("every question is well-formed (4 options, valid correctIndex, 4 explanations, unique id)", () => {
  for (const t of loadTracks()) {
    const ids = new Set<string>();
    for (const q of t.questions) {
      expect(q.id).toMatch(/^[a-z0-9-]+$/i);
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
      expect(q.prompt).toBeTruthy();
      expect(q.options).toHaveLength(4);
      for (const opt of q.options) expect(opt.length).toBeGreaterThan(0);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.explanations).toHaveLength(4);
      for (const exp of q.explanations) expect(exp.length).toBeGreaterThan(0);
    }
  }
});

it("sampleQuestions returns exactly `size` distinct items from the pool", () => {
  const pool = Array.from({ length: 100 }, (_, i) => `q${i}`);
  const sample = sampleQuestions(pool, 60);
  expect(sample).toHaveLength(60);
  expect(new Set(sample).size).toBe(60);
  for (const s of sample) expect(pool).toContain(s);
});

it("sampleQuestions returns a fresh copy (pool order intact, repeatable via injected rng)", () => {
  const pool = ["a", "b", "c", "d", "e"];
  // deterministic rng: always 0 → fisher-yates with j=0 each step
  const sample = sampleQuestions(pool, 3, () => 0);
  expect(sample).toHaveLength(3);
  expect(pool).toEqual(["a", "b", "c", "d", "e"]); // original untouched
});

it("sampleQuestions with size >= pool returns the whole pool", () => {
  const pool = ["a", "b", "c"];
  expect(sampleQuestions(pool, 60)).toEqual(["a", "b", "c"]);
});

it("getTrack returns the track by slug", () => {
  expect(getTrack("sysadmin")?.title).toBeTruthy();
  expect(getTrack("sysadmin")?.questions.length).toBeGreaterThanOrEqual(10);
});

it("getTrack returns null for unknown slug", () => {
  expect(getTrack("nonsense")).toBeNull();
});

it("rejects a malformed question file", () => {
  expect(() => loadTracksFromDir(badDir("only-3-options"))).toThrow(/options/);
});

// helper re-exported from bank for the fixture dir test
import { loadTracksFromDir } from "./bank";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function badDir(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `quiz-${name}-`));
  mkdirSync(dir);
  writeFileSync(path.join(dir, "sysadmin.json"), JSON.stringify({
    slug: "sysadmin", title: "X", description: "Y", durationSec: 60, passingPercent: 80,
    questions: [{ id: "a", prompt: "p", options: ["1", "2", "3"], correctIndex: 0, explanations: ["a", "b", "c", "d"] }],
  }));
  return dir;
}
