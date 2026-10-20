// src/app/test/page.tsx
// Skill Test home: pick a certification-style track.
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadTracks } from "@/lib/quiz/bank";
import { getBoard } from "@/lib/quiz/service";
import { TopBar } from "@/components/TopBar";
import { Leaderboard } from "@/components/Leaderboard";

export const dynamic = "force-dynamic";

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m % 60 === 0) return `${m / 60} jam`;
  return m >= 60 ? `${Math.floor(m / 60)} jam ${m % 60} menit` : `${m} menit`;
}

export default async function TestHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tracks = loadTracks();
  const boards = await Promise.all(tracks.map((t) => getBoard(t.slug)));

  return (
    <div className="docs-shell">
      <TopBar />
      <main className="test-main">
        <h1 className="test-title">Skill Test</h1>
        <p className="test-sub">Pilih track, kerjakan soal, lihat skormu.</p>
        <div className="track-grid">
          {tracks.map((t, i) => (
            <div className="track-card" key={t.slug}>
              <div className="track-head">
                <h2>{t.title}</h2>
                <span className="track-badge">{t.examSize} soal</span>
              </div>
              <p className="track-desc">{t.description}</p>
              <ul className="track-meta">
                <li>Durasi: {fmtDuration(t.durationSec)}</li>
                <li>Passing: {t.passingPercent}%</li>
                <li>{t.examSize} soal dari bank {t.questions.length}</li>
              </ul>
              <Leaderboard title="Top 5" entries={boards[i].entries} limit={5} />
              <Link className="btn btn-primary track-start" href={`/test/${t.slug}`}>
                Mulai →
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
