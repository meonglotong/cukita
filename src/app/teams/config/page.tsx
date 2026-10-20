// src/app/teams/config/page.tsx
// Tab-configuration page shown when a user adds the Gnosis tab to a channel.
// No auth needed here (the tab itself does the SSO).
import { TeamsTabConfig } from "./teams-tab-config";

export const metadata = { title: "Gnosis — Add tab" };

export default function TeamsConfigPage() {
  return <TeamsTabConfig />;
}
