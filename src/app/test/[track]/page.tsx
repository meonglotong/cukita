// src/app/test/[track]/page.tsx
// One certification-style test: briefing → timed quiz → score + review.
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTrack } from "@/lib/quiz/bank";
import { TopBar } from "@/components/TopBar";
import { QuizClient } from "@/components/QuizClient";

export const dynamic = "force-dynamic";

export default async function TestTrackPage({ params }: { params: Promise<{ track: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { track: slug } = await params;
  const track = getTrack(slug);
  if (!track) notFound();

  return (
    <div className="docs-shell">
      <TopBar />
      <main className="test-main">
        <QuizClient track={track} />
      </main>
    </div>
  );
}
