// src/app/login/page.tsx
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form action={login} style={{ width: 340, display: "grid", gap: 12 }}>
        <h1 style={{ fontSize: 20 }}>TeamDocs</h1>
        {error ? <p style={{ color: "#b91c1c", margin: 0 }}>Email atau password salah.</p> : null}
        <input name="email" type="email" placeholder="email" required
               style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8 }} />
        <input name="password" type="password" placeholder="password" required
               style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8 }} />
        <button style={{ padding: 10, borderRadius: 8, background: "var(--accent)", color: "#fff", border: 0 }}>Masuk</button>
      </form>
    </main>
  );
}
