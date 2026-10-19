// src/components/TopBar.tsx
import { auth, signOut } from "@/lib/auth";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export async function TopBar() {
  const session = await auth();
  const canManageUsers = session?.user.role === "admin" || session?.user.role === "superadmin";
  return (
    <header className="topbar">
      <a className="brand" href="/docs">
        <img className="logo logo-light" src="/logos/gnosis-light.png" alt="" width={38} height={38} />
        <img className="logo logo-dark" src="/logos/gnosis-dark.png" alt="" width={38} height={38} />
        Gnosis
      </a>
      <a className="topbar-nav" href="/test">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="0.5" fill="currentColor" />
        </svg>
        Skill Test
      </a>
      <SearchBox />
      <ThemeToggle />
      <UserMenu
        name={session?.user.name ?? "User"}
        role={session?.user.role ?? "user"}
        canManageUsers={canManageUsers}
        onSignOut={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      />
    </header>
  );
}
