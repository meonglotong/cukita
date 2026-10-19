// src/app/login/page.tsx
import { login } from "./actions";
import { oauthEnabled } from "@/lib/auth";
import { MicrosoftLoginButton } from "./microsoft-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login-wrap">
      <form action={login} className="login-card">
        <img className="login-logo login-logo-light" src="/logos/gnosis-light.png" alt="Gnosis" width={72} height={72} />
        <img className="login-logo login-logo-dark" src="/logos/gnosis-dark.png" alt="Gnosis" width={72} height={72} />
        <h1>Gnosis</h1>
        <p className="sub">Knowledge base tim</p>
        {error ? (
          <p style={{ color: "var(--danger)", margin: 0, fontSize: 13 }}>
            {error === "rate" ? "Terlalu banyak percobaan, coba lagi dalam 1 menit." : "Email atau password salah."}
          </p>
        ) : null}
        <input name="email" type="email" placeholder="email" required autoComplete="email" />
        <input name="password" type="password" placeholder="password" required autoComplete="current-password" />
        <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Masuk</button>
        {oauthEnabled ? <MicrosoftLoginButton /> : null}
      </form>
    </main>
  );
}
