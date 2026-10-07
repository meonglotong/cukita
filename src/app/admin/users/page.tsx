// src/app/admin/users/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UserManager } from "@/components/UserManager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  // admin + superadmin can view; only superadmin gets interactive controls
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "superadmin")) {
    redirect("/docs");
  }
  return (
    <section>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Users</h1>
      <UserManager viewerRole={session.user.role} />
    </section>
  );
}
