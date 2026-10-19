// src/components/TopBar.tsx
import { auth, signOut } from "@/lib/auth";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";

export async function TopBar() {
  const session = await auth();
  const canManageUsers = session?.user.role === "admin" || session?.user.role === "superadmin";
  return (
    <header className="topbar">
      <a className="brand" href="/docs">
        <img className="logo logo-light" src="/logos/gnosis-light.png" alt="" width={32} height={32} />
        <img className="logo logo-dark" src="/logos/gnosis-dark.png" alt="" width={32} height={32} />
        Gnosis
      </a>
      <a className="topbar-nav" href="/test">Skill Test</a>
      <SearchBox />
      <ThemeToggle />
      <div className="userchip">
        {canManageUsers ? (
          <a href="/admin/users">Admin</a>
        ) : null}
        <a href="/account" className="acct-link">Ganti password</a>
        <span>{session?.user.name}</span>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="btn" type="submit">Logout</button>
        </form>
      </div>
    </header>
  );
}
