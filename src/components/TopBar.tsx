// src/components/TopBar.tsx
import { auth, signOut } from "@/lib/auth";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";
import { TopBarSkillTest } from "./TopBarSkillTest";
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
      <TopBarSkillTest />
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
