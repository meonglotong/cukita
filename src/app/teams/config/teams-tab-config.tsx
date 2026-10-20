"use client";

// src/app/teams/config/teams-tab-config.tsx
// Registers the tab config with the Teams webview (configuration frame):
// sets the content URL the tab will open once the user clicks "Add".
import { useEffect } from "react";
import * as microsoftTeams from "@microsoft/teams-js";

export function TeamsTabConfig() {
  useEffect(() => {
    void microsoftTeams.app.initialize().then(() => {
      void microsoftTeams.pages.config.setConfig({
        contentUrl: `${window.location.origin}/teams`,
        suggestedDisplayName: "Gnosis",
      });
    });
  }, []);

  // Rendered only if the Teams webview is not present (dev/preview).
  return (
    <main style={{ fontFamily: "system-ui", padding: 40 }}>
      <h1>Gnosis</h1>
      <p>Halaman konfigurasi tab — buka lewat Teams (channel → + → Gnosis).</p>
    </main>
  );
}
