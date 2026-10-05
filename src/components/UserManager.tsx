// src/components/UserManager.tsx
"use client";
import { useCallback, useEffect, useState } from "react";

type AdminUser = { id: string; email: string; name: string; role: "admin" | "user"; active: boolean; createdAt: string };
type AddForm = { email: string; name: string; password: string; role: "admin" | "user" };
const EMPTY_ADD: AddForm = { email: "", name: "", password: "", role: "user" };

export function UserManager() {
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
            <th>Email</th><th>Name</th><th>Role</th><th>Active</th><th>Reset password</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td>{u.email}</td>
              <td>{u.name}</td>
              <td>
                <select value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>
                <input type="checkbox" checked={u.active} onChange={(e) => patch(u.id, { active: e.target.checked })} />
              </td>
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
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={addUser} style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Add user:</span>
        <input placeholder="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} />
        <input placeholder="name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
        <input type="password" placeholder="password (min 8)" value={add.password} onChange={(e) => setAdd({ ...add, password: e.target.value })} />
        <select value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value as "admin" | "user" })}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button>add</button>
      </form>
    </div>
  );
}
