// src/lib/auth/oauth.ts
// Local-account resolution for OAuth sign-ins (Microsoft 365 / Azure AD).
// The provider signs the user in with an identity-provider user id, so the
// JWT callback maps the OAuth identity to our local `users` row by email:
// existing account → link it; unknown email → provision a role "user" account.
import { query } from "../db";
import type { Role } from "../auth";

export interface OauthUserInput {
  email: string | null | undefined;
  name: string | null | undefined;
}

export interface OauthUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
}

// Find the local user for an OAuth email; provision one (role "user",
// active, no password) when the email is unknown. Returns null when the
// email is empty or the local account is inactive.
export async function resolveOrProvisionOauthUser(input: OauthUserInput): Promise<OauthUserRow | null> {
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!email) return null;

  const { rows } = await query("SELECT id, email, name, role, active FROM users WHERE email = $1", [email]);
  let user = rows[0];
  if (!user) {
    const { rows: created } = await query(
      `INSERT INTO users (email, name, password_hash, role, active)
       VALUES ($1, $2, NULL, 'user', true)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name, role, active`,
      [email, String(input.name ?? email)]
    );
    user = created[0];
    // Lost a race with a concurrent provision — re-read the winner.
    if (!user) {
      const retry = await query("SELECT id, email, name, role, active FROM users WHERE email = $1", [email]);
      user = retry.rows[0];
    }
  }
  if (!user || !user.active) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}
