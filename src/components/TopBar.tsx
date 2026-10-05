// src/components/TopBar.tsx
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { SearchBox } from "./SearchBox";

export async function TopBar() {
  const session = await auth();
  return (
    <header className="topbar">
      <span className="brand">TeamDocs</span>
      <SearchBox />
      <nav style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 14 }}>
        <Link href="/files">Files</Link>
        {session?.user.role === "admin" ? <Link href="/admin/docs">Admin</Link> : null}
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button style={{ background: "none", border: 0, color: "var(--muted)", cursor: "pointer" }}>Logout</button>
        </form>
      </nav>
    </header>
  );
}
