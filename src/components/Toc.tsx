// src/components/Toc.tsx
"use client";
import { useEffect, useState } from "react";
import { pickActiveHeading } from "./toc-scrollspy";

interface TocItem { level: 2 | 3; text: string; id: string }

export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

  // Scroll-spy: measure heading positions on scroll (rAF-throttled) and
  // highlight the heading the reader is currently reading.
  useEffect(() => {
    const ids = items.map((i) => i.id);
    let raf = 0;

    const measure = () => {
      raf = 0;
      const tops: Record<string, number> = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) tops[id] = el.getBoundingClientRect().top;
      }
      setActive(pickActiveHeading(ids, tops));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  if (items.length === 0) return null;
  return (
    <nav className="toc">
      <div className="toc-title">On this page</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((t) => (
          <li key={t.id} style={{ paddingLeft: t.level === 3 ? 14 : 0 }}>
            <a
              href={`#${t.id}`}
              className={`toc-link${active === t.id ? " active" : ""}`}
            >
              {t.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
