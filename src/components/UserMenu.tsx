// src/components/UserMenu.tsx
// Grafana-style user menu: satu tombol avatar di topbar, dropdown berisi
// identitas user + aksi (ganti password, admin, logout) — satu per baris
// supaya tidak menumpuk. onSignOut adalah server action dari TopBar.
"use client";
import { useEffect, useRef, useState } from "react";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
};

function Icon({ d, extra }: { d: string; extra?: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
      {extra}
    </svg>
  );
}

const LockIcon = () => (
  <Icon d="M8 11V7a4 4 0 0 1 8 0v4" extra={<rect x="5" y="11" width="14" height="10" rx="2" />} />
);
const UsersIcon = () => (
  <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra={<circle cx="12" cy="7" r="4" />} />
);
const LogoutIcon = () => (
  <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
    extra={<><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>} />
);

export function UserMenu({
  name,
  role,
  canManageUsers,
  onSignOut,
}: {
  name: string;
  role: string;
  canManageUsers: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (name.trim().charAt(0) || "?").toUpperCase();

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    await onSignOut();
  };

  return (
    <div className="usermenu" ref={rootRef}>
      <button
        type="button"
        className={`usermenu-btn${open ? " open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="usermenu-avatar">{initial}</span>
        <span className="usermenu-name">{name}</span>
        <span className="usermenu-chev">▾</span>
      </button>
      {open ? (
        <div className="usermenu-drop" role="menu">
          <div className="usermenu-head">
            <span className="usermenu-avatar lg">{initial}</span>
            <span className="usermenu-head-text">
              <strong>{name}</strong>
              <small>{ROLE_LABEL[role] ?? role}</small>
            </span>
          </div>
          <div className="usermenu-sep" />
          <a href="/account" role="menuitem" className="usermenu-item" onClick={() => setOpen(false)}>
            <LockIcon /> Ganti Password
          </a>
          {canManageUsers ? (
            <a href="/admin/users" role="menuitem" className="usermenu-item" onClick={() => setOpen(false)}>
              <UsersIcon /> Admin
            </a>
          ) : null}
          <div className="usermenu-sep" />
          <button type="button" role="menuitem" className="usermenu-item" disabled={busy}
            onClick={() => void logout()}>
            <LogoutIcon /> {busy ? "Logout..." : "Logout"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
