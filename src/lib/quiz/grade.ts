// src/lib/quiz/grade.ts
// Pure grading: no I/O, deterministic, testable in isolation.
import type { AnswerMap, GradeResult, GradedQuestion, QuizQuestion } from "./types";

export function grade(questions: QuizQuestion[], answers: AnswerMap, passingPercent: number): GradeResult {
  const graded: GradedQuestion[] = questions.map((question) => {
    const chosen = answers[question.id] ?? null;
    return {
      questionId: question.id,
      chosen,
      correctIndex: question.correctIndex,
      isCorrect: chosen === question.correctIndex,
    };
  });

  const score = graded.filter((g) => g.isCorrect).length;
  const total = graded.length;
  const percent = total === 0 ? 0 : Math.round((score / total) * 1000) / 10;

  return { score, total, percent, passed: percent >= passingPercent, questions: graded };
}
