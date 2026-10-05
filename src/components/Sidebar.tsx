// src/components/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Node { id: string; title: string; slug: string | null; isSection: boolean; children: Node[] }

export function Sidebar({ tree }: { tree: Node[] }) {
  const pathname = usePathname();
  const render = (nodes: Node[], depth: number) => (
    <ul style={{ paddingLeft: depth ? 12 : 0 }}>
      {nodes.map((n) => {
        const active = pathname === `/docs/${n.slug}`;
        return (
          <li key={n.id}>
            {n.isSection ? (
              <span className="side-section">{n.title}</span>
            ) : (
              <Link href={`/docs/${n.slug}`} className={`side-link${active ? " active" : ""}`}>
                {n.title}
              </Link>
            )}
            {n.children.length > 0 ? render(n.children, depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );
  return <nav className="docs-sidebar">{render(tree, 0)}</nav>;
}
