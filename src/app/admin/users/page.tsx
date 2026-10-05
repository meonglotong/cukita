// src/app/admin/users/page.tsx
import { UserManager } from "@/components/UserManager";

export default function AdminUsersPage() {
  return (
    <section>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Users</h1>
      <UserManager />
    </section>
  );
}
