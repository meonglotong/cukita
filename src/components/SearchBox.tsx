// src/components/SearchBox.tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ slug: string; title: string; snippet: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <div className="searchbox" style={{ position: "relative" }}>
      <input
        value={q}
        placeholder="Cari dokumentasi…"
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          startTransition(async () => {
            if (v.trim().length < 2) { setResults([]); return; }
            const res = await fetch(`/api/search?q=${encodeURIComponent(v)}`);
            setResults((await res.json()).results);
          });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 ? (
        <div className="search-results">
          {results.map((r) => (
            <Link key={r.slug} href={`/docs/${r.slug}`}>
              <strong>{r.title}</strong>
              <div className="snip">{r.snippet}</div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
