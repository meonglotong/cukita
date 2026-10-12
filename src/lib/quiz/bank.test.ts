// src/lib/quiz/bank.test.ts
import { it, expect } from "vitest";
import { loadTracks, getTrack } from "./bank";

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
    expect(t.questions.length).toBeGreaterThanOrEqual(10);
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
