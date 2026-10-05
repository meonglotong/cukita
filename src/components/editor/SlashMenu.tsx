// src/components/editor/SlashMenu.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { filterSlashItems, type SlashItem, type SlashState } from "./slash-command";

export function SlashMenu({ editor, slash, onDone }: {
  editor: Editor;
  slash: SlashState;
  onDone: () => void;
}) {
  const items = useMemo(() => filterSlashItems(slash.query), [slash.query]);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const pick = (item: SlashItem | undefined) => {
    if (!item) return;
    item.run(editor, slash.range);
    onDone();
  };

  // Keyboard navigation while the menu is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); }
      else if (e.key === "Enter") { e.preventDefault(); pick(items[activeRef.current]); }
      else if (e.key === "Escape") { e.preventDefault(); onDone(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // items/active are read through refs/state inside the listener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, slash.range.from, slash.range.to, editor]);

  return (
    <div ref={ref} className="slash-menu" style={{ position: "fixed", top: slash.coords.top + 4, left: slash.coords.left }}>
      <div className="slash-menu-head">Blok</div>
      {items.length === 0 ? (
        <div className="slash-menu-empty">Tidak ada hasil</div>
      ) : items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          className={`slash-menu-item${i === active ? " active" : ""}`}
          onMouseEnter={() => setActive(i)}
          onClick={() => pick(item)}
        >
          <span className="slash-menu-icon">{item.icon}</span>
          <span>
            <span className="slash-menu-title">{item.title}</span>
            <span className="slash-menu-desc">{item.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
