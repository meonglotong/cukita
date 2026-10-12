// src/lib/quiz/types.ts
// Domain shapes for the certification-style skill test.

export interface QuizQuestion {
  id: string;
  prompt: string;
  // Four choice labels, in display order.
  options: [string, string, string, string];
  // Index (0-3) into `options` of the correct answer.
  correctIndex: number;
  // Parallel to `options`: explanation of why that option is right/wrong.
  explanations: [string, string, string, string];
}

export interface QuizTrack {
  slug: string;
  title: string;
  description: string;
  // Total time allowed for the attempt, in seconds.
  durationSec: number;
  // 0-100 score needed to pass.
  passingPercent: number;
  // Number of questions in each exam, randomly drawn from the pool.
  examSize: number;
  // Full question pool (the exam is a random sample of this).
  questions: QuizQuestion[];
}

export type AnswerMap = Record<string, number>; // question id -> chosen option index

export interface GradedQuestion {
  questionId: string;
  chosen: number | null; // null = unanswered
  correctIndex: number;
  isCorrect: boolean;
}

export interface GradeResult {
  score: number; // count of correct
  total: number; // count of questions
  percent: number; // 0-100, one decimal
  passed: boolean;
  questions: GradedQuestion[];
}
