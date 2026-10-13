"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

// "Login dengan Microsoft" — OAuth flow handled by NextAuth (azure-ad).
export function MicrosoftLoginButton() {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="login-divider">
        <span>atau</span>
      </div>
      <button
        type="button"
        className="btn btn-ms"
        style={{ width: "100%" }}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signIn("microsoft-entra-id", { callbackUrl: "/" });
        }}
      >
        {busy ? "Membuka Microsoft…" : "Login dengan Microsoft"}
      </button>
    </>
  );
}
