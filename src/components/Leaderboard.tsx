// src/components/Leaderboard.tsx
// Presentational top-N board for one quiz track.
import type { BoardEntry } from "@/lib/quiz/service";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

export function Leaderboard({ title, entries, limit = 10 }: { title: string; entries: BoardEntry[]; limit?: number }) {
  const shown = entries.slice(0, limit);
  return (
    <div className="board">
      <h3 className="board-title">{title}</h3>
      {shown.length === 0 ? (
        <p className="board-empty">Belum ada yang ikut. Jadilah yang pertama!</p>
      ) : (
        <table className="table board-table">
          <thead>
            <tr><th>#</th><th>Nama</th><th>Skor</th><th>Tanggal</th></tr>
          </thead>
          <tbody>
            {shown.map((e, i) => (
              <tr key={e.userId} className={i < 3 ? "board-medal" : undefined}>
                <td>{i + 1}</td>
                <td>{e.name}</td>
                <td className="board-score">{e.bestScore}/{e.total}</td>
                <td className="board-date">{fmtDate(e.atBest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
