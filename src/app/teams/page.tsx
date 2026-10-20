// src/app/teams/page.tsx
// Entry point for the Gnosis tab inside Microsoft Teams.
// The client component runs the MSAL silent-SSO handshake; on success the
// session is created by /api/teams/sso and the tab lands on /docs.
import { TeamsSso } from "./teams-sso";

export const metadata = { title: "Gnosis" };

const clientId = process.env.AZURE_AD_ID ?? "";
const tenant = process.env.AZURE_AD_TENANT ?? "common";

export default function TeamsPage() {
  if (!clientId) {
    return (
      <main className="docs-main" style={{ maxWidth: 560, margin: "120px auto", padding: "0 16px" }}>
        <h1>Gnosis</h1>
        <p>Login Microsoft belum dikonfigurasi di server (AZURE_AD_ID kosong).</p>
      </main>
    );
  }
  return <TeamsSso clientId={clientId} tenant={tenant} />;
}
