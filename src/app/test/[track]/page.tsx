// src/app/test/[track]/page.tsx
// One certification-style test: briefing → timed quiz → score + review.
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTrack, sampleQuestions } from "@/lib/quiz/bank";
import { TopBar } from "@/components/TopBar";
import { QuizClient } from "@/components/QuizClient";

export const dynamic = "force-dynamic";

export default async function TestTrackPage({ params }: { params: Promise<{ track: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { track: slug } = await params;
  const track = getTrack(slug);
  if (!track) notFound();

  // Random exam: draw a fresh sample from the pool on every request.
  // The key (first two question ids) forces a full remount when the user
  // navigates back for "Kerjakan Lagi" — state resets, questions are new.
  const exam = sampleQuestions(track.questions, track.examSize);
  const examKey = exam.slice(0, 2).map((q) => q.id).join("|");

  return (
    <div className="docs-shell">
      <TopBar />
      <main className="test-main">
        <QuizClient key={examKey} track={{ ...track, questions: exam }} />
      </main>
    </div>
  );
}
