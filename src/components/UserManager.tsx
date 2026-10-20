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

  const deleteUser = (u: AdminUser) => {
    const ok = window.confirm(
      `Hapus ${u.email}?\n\n- semua hasil ujian (quiz attempts) mereka ikut terhapus\n- dokumen yang mereka buat tetap ada, tapi jadi tanpa author\n- tindakan ini permanen`
    );
    if (!ok) return;
    void (async () => {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setMsg(`delete failed: ${json.error}`); return; }
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
      {msg ? <p className="admin-msg">{msg}</p> : null}
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th><th>Nama</th><th>Role</th><th>Aktif</th>{canManage ? <th>Reset password</th> : null}{canManage ? <th>Aksi</th> : null}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td>
                  {canManage ? (
                    <select className="admin-select" value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="superadmin">superadmin</option>
                    </select>
                  ) : (
                    <span className={`role-badge ${u.role}`}>{u.role}</span>
                  )}
                </td>
                <td>
                  {canManage ? (
                    <input className="admin-check" type="checkbox" checked={u.active} onChange={(e) => patch(u.id, { active: e.target.checked })} />
                  ) : (
                    u.active ? "ya" : "tidak"
                  )}
                </td>
                {canManage ? (
                  <td>
                    <div className="admin-pw">
                      <input
                        type="password"
                        placeholder="password baru"
                        value={newPasswords[u.id] ?? ""}
                        onChange={(e) => setNewPasswords({ ...newPasswords, [u.id]: e.target.value })}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!newPasswords[u.id]}
                        onClick={() => patch(u.id, { password: newPasswords[u.id] })}
                      >
                        Set
                      </button>
                    </div>
                  </td>
                ) : null}
                {canManage ? (
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u)}>
                      Hapus
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="admin-add" onSubmit={addUser}>
        <h2>Tambah pengguna</h2>
        <div className="admin-add-grid">
          <div className="field">
            <label>Email</label>
            <input type="email" required placeholder="nama@fds.co.id" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Nama</label>
            <input required value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Password (min 8)</label>
            <input type="password" required minLength={8} value={add.password} onChange={(e) => setAdd({ ...add, password: e.target.value })} />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value as Role })}>
              <option value="user">user</option>
              <option value="admin">admin</option>
              {canManage ? <option value="superadmin">superadmin</option> : null}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Tambah</button>
        </div>
      </form>
    </div>
  );
}
