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
      <h1 className="page-title">Users</h1>
      <p className="page-sub">Kelola akun tim: role, status aktif, dan password.</p>
      <UserManager viewerRole={session.user.role} />
    </section>
  );
}
