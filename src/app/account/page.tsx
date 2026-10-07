// src/app/account/page.tsx
// Self-service password change. Mirrors the login card layout.
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { changePassword } from "@/lib/users/service";

export const dynamic = "force-dynamic";

async function submit(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/login");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!current || !next) redirect("/account?error=isi");
  if (next !== confirm) redirect("/account?error=confirm");
  if (next.length < 8) redirect("/account?error=pendek");
  try {
    await changePassword(session.user.id, current, next);
    redirect("/account?msg=changed");
  } catch (e) {
    const code = (e as { code?: string }).code;
    redirect(code === "WRONG_PASSWORD" ? "/account?error=wrong" : "/account?error=generic");
  }
}

const MESSAGES: Record<string, { text: string; ok?: boolean }> = {
  changed: { text: "Password sudah diganti.", ok: true },
  isi: { text: "Semua field wajib diisi." },
  confirm: { text: "Konfirmasi password baru tidak sama." },
  pendek: { text: "Password baru minimal 8 karakter." },
  wrong: { text: "Password saat ini salah." },
  generic: { text: "Gagal mengganti password, coba lagi." },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { msg, error } = await searchParams;
  const notice = msg ? MESSAGES[msg] : error ? MESSAGES[error] : null;
  return (
    <main className="login-wrap">
      <form action={submit} className="login-card">
        <h1>Ganti password</h1>
        <p className="sub">Password baru minimal 8 karakter</p>
        {notice ? (
          <p style={{ color: notice.ok ? "var(--accent)" : "var(--danger)", margin: "0 0 12px", fontSize: 13 }}>
            {notice.text}
          </p>
        ) : null}
        <input name="current" type="password" placeholder="password saat ini" required autoComplete="current-password" />
        <input name="next" type="password" placeholder="password baru" required autoComplete="new-password" />
        <input name="confirm" type="password" placeholder="konfirmasi password baru" required autoComplete="new-password" />
        <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Ganti password</button>
      </form>
    </main>
  );
}
