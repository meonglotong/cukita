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
  return m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m} menit`;
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
        <p className="test-sub">
          Simulasi sertifikasi berbasis soal. Pilih track, kerjakan melawan waktu, dan
          lihat di mana posisi kamu di papan skor.
        </p>
        <div className="track-grid">
          {tracks.map((t, i) => (
            <div className="track-card" key={t.slug}>
              <div className="track-head">
                <h2>{t.title}</h2>
                <span className="track-badge">{t.questions.length} soal</span>
              </div>
              <p className="track-desc">{t.description}</p>
              <ul className="track-meta">
                <li>⏱ {fmtDuration(t.durationSec)}</li>
                <li>🎯 Passing line {t.passingPercent}%</li>
                <li>📝 {t.questions.length} soal pilihan ganda</li>
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
