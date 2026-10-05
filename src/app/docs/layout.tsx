// src/app/docs/layout.tsx
import { getPagesTree } from "@/lib/docs/service";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const tree = await getPagesTree();
  return (
    <div className="docs-shell">
      <TopBar />
      <div className="docs-columns">
        <Sidebar tree={tree} />
        <main className="docs-main">{children}</main>
      </div>
    </div>
  );
}
