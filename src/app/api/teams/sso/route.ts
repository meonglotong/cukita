// src/app/api/teams/sso/route.ts
// Silent SSO for the Gnosis Teams tab. The /teams page (MSAL in the Teams
// webview) sends the M365 id_token here; we sign the user in through the
// existing NextAuth microsoft-entra-id provider (id_token validation) and
// return the redirect target. Browser SSO flows are untouched.
import { signIn } from "@/lib/auth";

const DEFAULT_TARGET = "/docs";

export async function POST(req: Request) {
  let idToken: string | undefined;
  let target: string | undefined;
  try {
    const body = await req.json();
    idToken = body?.idToken;
    target = body?.target;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof idToken !== "string" || idToken.length < 32) {
    return Response.json({ error: "idToken required" }, { status: 400 });
  }
  // Only allow internal relative targets (tab lands inside the app).
  const redirectTo = typeof target === "string" && target.startsWith("/") ? target : DEFAULT_TARGET;

  const res = await signIn("microsoft-entra-id", {
    idToken,
    redirect: false,
    callbackUrl: redirectTo,
  });
  if (!res || res.error) {
    return Response.json({ error: "auth failed" }, { status: 401 });
  }
  return Response.json({ ok: true, redirectTo });
}
