"use client";

// src/app/teams/teams-sso.tsx
// MSAL silent SSO for the Teams webview. Inside Teams, acquireTokenPopup with
// prompt "select_account" performs the SSO handshake invisibly; the id_token
// is exchanged for a Gnosis session via /api/teams/sso.
import { useCallback, useEffect, useRef, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import type { Configuration } from "@azure/msal-browser";

const SCOPES = ["openid", "profile", "email"];

export function TeamsSso({ clientId, tenant }: { clientId: string; tenant: string }) {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState("");
  const started = useRef(false);

  const run = useCallback(async () => {
    const config: Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenant}`,
      },
    };
    const msal = new PublicClientApplication(config);
    await msal.initialize();
    let idToken: string | undefined;

    try {
      // 1) silent (token already cached in this webview)
      const silent = await msal.acquireTokenSilent({ scopes: SCOPES });
      idToken = silent.idToken;
    } catch {
      // 2) Teams SSO handshake: popup is invisible inside the Teams webview
      try {
        const popup = await msal.acquireTokenPopup({ scopes: SCOPES, prompt: "select_account" });
        idToken = popup.idToken;
      } catch (e) {
        throw e;
      }
    }

    if (!idToken) throw new Error("no id_token");
    const res = await fetch("/api/teams/sso", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken, target: "/docs" }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error ?? "sso failed");
    window.location.assign(data.redirectTo ?? "/docs");
  }, [clientId, tenant]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    });
  }, [run]);

  return (
    <main className="docs-main" style={{ maxWidth: 560, margin: "120px auto", padding: "0 16px" }}>
      <h1>Gnosis</h1>
      {status === "loading" ? (
        <p>Masuk otomatis ke Gnosis…</p>
      ) : (
        <>
          <p>Masuk otomatis gagal: {error}</p>
          <p>
            Buka <a href="/login">halaman login Gnosis</a> lalu pilih "Login dengan Microsoft".
          </p>
        </>
      )}
    </main>
  );
}
