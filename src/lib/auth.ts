// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export type Role = "admin" | "user";

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
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
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
