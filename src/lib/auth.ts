// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import AzureAD from "next-auth/providers/microsoft-entra-id";

export type Role = "superadmin" | "admin" | "user";

// True when the Microsoft Entra ID provider is configured (env present).
export const oauthEnabled = Boolean(process.env.AZURE_AD_ID && process.env.AZURE_AD_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "email" },
        password: { label: "password", type: "password" },
      },
      // db/password are Node-only (pg, @node-rs/argon2); imported lazily so
      // the Edge middleware bundle (which imports `auth`) never loads them.
      authorize: async (creds) => {
        const { query } = await import("./db");
        const { verifyPassword } = await import("./password");
        const email = String(creds.email ?? "");
        const password = String(creds.password ?? "");
        const { rows } = await query(
          "SELECT id, email, name, password_hash, role, active FROM users WHERE email = $1",
          [email]
        );
        const user = rows[0];
        if (!user || !user.active) return null;
        const ok = await verifyPassword(user.password_hash, password);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
      },
    }),
    // Microsoft 365 login. Only active when the tenant is configured via
    // env (dev/test boxes without it keep the credentials-only setup).
    ...(process.env.AZURE_AD_ID && process.env.AZURE_AD_SECRET
      ? [
          AzureAD({
            clientId: process.env.AZURE_AD_ID,
            clientSecret: process.env.AZURE_AD_SECRET,
            // single-tenant (org-only) when AZURE_AD_TENANT is set;
            // without it the provider falls back to the "common" issuer.
            issuer: process.env.AZURE_AD_TENANT
              ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT}/v2.0`
              : undefined,
            // Link the OAuth identity to the local account by email, so an
            // existing Gnosis user keeps one session/identity.
            allowDangerousEmailAccountLinking: true,
            // Validates a raw id_token (Teams tab silent SSO: /api/teams/sso
            // passes the MSAL id_token directly; browser login is unaffected).
            idToken: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        if (user.role) {
          // credentials provider: role already resolved in authorize()
          token.role = user.role;
        } else {
          // OAuth provider: map to the local account (auto-provision if new)
          const { resolveOrProvisionOauthUser } = await import("./auth/oauth");
          const local = await resolveOrProvisionOauthUser({ email: user.email, name: user.name });
          if (local) {
            token.sub = local.id; // session.id / session.user.id = local user
            token.role = local.role;
            token.name = local.name;
          }
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
