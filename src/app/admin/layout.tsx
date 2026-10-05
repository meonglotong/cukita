// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/docs");
  return (
    <div className="docs-shell">
      <TopBar />
      <main className="docs-main" style={{ maxWidth: 900 }}>
        <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/docs">Docs</Link>
        </nav>
        {children}
      </main>
    </div>
  );
}
