// src/components/Toc.tsx
"use client";
import { useEffect, useState } from "react";
import { activeAtBottom, pickActiveHeading } from "./toc-scrollspy";
import { resolveHeading } from "./editor/heading-ids";

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
      for (const item of items) {
        const el = resolveHeading(document, item.id, item.text);
        if (el) tops[item.id] = el.getBoundingClientRect().top;
      }
      // The section the reader is "in" = the last heading that has crossed
      // an anchor line at 60% of the viewport (a top anchor is too strict —
      // a section only "activates" once most of it has scrolled past).
      // At the bottom of the page the last section always wins, because a
      // short page can never bring its final heading up to the anchor.
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      setActive(atBottom ? activeAtBottom(ids, tops) : pickActiveHeading(ids, tops, window.innerHeight * 0.6));
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
              onClick={(e) => {
                // Smooth-scroll to the heading (id fast path, text fallback);
                // keep the URL hash in sync without the default jump.
                e.preventDefault();
                resolveHeading(document, t.id, t.text)?.scrollIntoView({ behavior: "smooth", block: "start" });
                window.history.replaceState(null, "", `#${t.id}`);
              }}
            >
              {t.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
