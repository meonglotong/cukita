// src/lib/quiz/grade.test.ts
import { it, expect } from "vitest";
import { grade } from "./grade";
import type { QuizQuestion } from "./types";

function q(id: string, correctIndex: number): QuizQuestion {
  return {
    id,
    prompt: `soal ${id}`,
    options: ["A", "B", "C", "D"],
    correctIndex,
    explanations: ["a", "b", "c", "d"],
  };
}

const questions = [q("q1", 0), q("q2", 1), q("q3", 2), q("q4", 3)];

it("counts only correct answers", () => {
  const r = grade(questions, { q1: 0, q2: 1, q3: 0, q4: 3 }, 80);
  expect(r.score).toBe(3);
  expect(r.total).toBe(4);
});

it("treats unanswered as wrong, not skipped", () => {
  const r = grade(questions, { q1: 0, q4: 3 }, 80);
  expect(r.score).toBe(2);
  expect(r.questions.find((x) => x.questionId === "q2")?.chosen).toBeNull();
  expect(r.questions.find((x) => x.questionId === "q2")?.isCorrect).toBe(false);
});

it("passes at exactly the passing percent", () => {
  // 80% of 5 = 4 correct
  const qs = [q("a", 0), q("b", 1), q("c", 2), q("d", 3), q("e", 0)];
  const r = grade(qs, { a: 0, b: 1, c: 2, d: 3, e: 1 }, 80);
  expect(r.percent).toBe(80);
  expect(r.passed).toBe(true);
});

it("fails just below the passing percent", () => {
  const qs = [q("a", 0), q("b", 1), q("c", 2), q("d", 3), q("e", 0)];
  const r = grade(qs, { a: 0, b: 1, c: 2, d: 0, e: 1 }, 80);
  expect(r.percent).toBe(60);
  expect(r.passed).toBe(false);
});

it("rounds percent to one decimal", () => {
  const qs = [q("a", 0), q("b", 1), q("c", 2)];
  const r = grade(qs, { a: 0, b: 1, c: 1 }, 50);
  expect(r.percent).toBe(66.7);
});

it("per-question results carry the chosen and correct index", () => {
  const r = grade(questions, { q1: 0, q2: 2 }, 50);
  const q2 = r.questions.find((x) => x.questionId === "q2")!;
  expect(q2.chosen).toBe(2);
  expect(q2.correctIndex).toBe(1);
  expect(q2.isCorrect).toBe(false);
});

it("empty answer map scores zero and fails", () => {
  const r = grade(questions, {}, 80);
  expect(r.score).toBe(0);
  expect(r.percent).toBe(0);
  expect(r.passed).toBe(false);
});
