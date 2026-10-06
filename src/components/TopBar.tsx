// src/components/TopBar.tsx
import { auth, signOut } from "@/lib/auth";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";

export async function TopBar() {
  const session = await auth();
  return (
    <header className="topbar">
      <span className="brand"><span className="logo">CK</span>CUKITA</span>
      <SearchBox />
      <ThemeToggle />
      <div className="userchip">
        {session?.user.role === "admin" ? (
          <a href="/admin/users">Admin</a>
        ) : null}
        <span>{session?.user.name}</span>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="btn" type="submit">Logout</button>
        </form>
      </div>
    </header>
  );
}
