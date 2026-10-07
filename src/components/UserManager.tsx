// src/components/UserManager.tsx
"use client";
import { useCallback, useEffect, useState } from "react";

type Role = "superadmin" | "admin" | "user";
type AdminUser = { id: string; email: string; name: string; role: Role; active: boolean; createdAt: string };
type AddForm = { email: string; name: string; password: string; role: Role };
const EMPTY_ADD: AddForm = { email: "", name: "", password: "", role: "user" };

// viewerRole controls what is interactive: superadmin manages everything
// (role, active, other users' passwords); admin sees a read-only list and
// may only add users (role: user/admin — the API enforces both).
export function UserManager({ viewerRole }: { viewerRole: Role }) {
  const canManage = viewerRole === "superadmin";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [add, setAdd] = useState<AddForm>(EMPTY_ADD);
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers((await res.json()).users);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const patch = (id: string, body: Record<string, unknown>) => {
    void (async () => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setMsg(`PATCH failed: ${json.error}`); return; }
      location.reload();
    })();
  };

  const addUser = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(add) });
      const json = await res.json();
      if (!res.ok) { setMsg(`add failed: ${json.error}`); return; }
      location.reload();
    })();
  };

  return (
    <div>
      {msg ? <p style={{ color: "var(--muted)", marginBottom: 8 }}>{msg}</p> : null}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
            <th>Email</th><th>Name</th><th>Role</th><th>Active</th>{canManage ? <th>Reset password</th> : null}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td>{u.email}</td>
              <td>{u.name}</td>
              <td>
                {canManage ? (
                  <select value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                ) : (
                  u.role
                )}
              </td>
              <td>
                {canManage ? (
                  <input type="checkbox" checked={u.active} onChange={(e) => patch(u.id, { active: e.target.checked })} />
                ) : (
                  u.active ? "yes" : "no"
                )}
              </td>
              {canManage ? (
                <td style={{ display: "flex", gap: 6 }}>
                  <input
                    type="password"
                    placeholder="new password"
                    value={newPasswords[u.id] ?? ""}
                    onChange={(e) => setNewPasswords({ ...newPasswords, [u.id]: e.target.value })}
                  />
                  <button
                    disabled={!newPasswords[u.id]}
                    onClick={() => patch(u.id, { password: newPasswords[u.id] })}
                  >
                    set
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={addUser} style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Add user:</span>
        <input placeholder="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} />
        <input placeholder="name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
        <input type="password" placeholder="password (min 8)" value={add.password} onChange={(e) => setAdd({ ...add, password: e.target.value })} />
        <select value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value as Role })}>
          <option value="user">user</option>
          <option value="admin">admin</option>
          {canManage ? <option value="superadmin">superadmin</option> : null}
        </select>
        <button>add</button>
      </form>
    </div>
  );
}
