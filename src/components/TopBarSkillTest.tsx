"use client";

// src/components/TopBarSkillTest.tsx
// Skill Test nav pill. Hidden inside the Microsoft Teams webview (the Teams
// tab is docs-only); identical everywhere else.
import { useEffect, useState } from "react";

export function TopBarSkillTest() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const ua = navigator.userAgent;
    // Teams desktop/mobile webviews carry "TEAMS" in the UA string.
    if (/TEAMS|TeamsApp/i.test(ua)) setVisible(false);
  }, []);

  if (!visible) return null;
  return (
    <a className="topbar-nav" href="/test">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="0.5" fill="currentColor" />
      </svg>
      Skill Test
    </a>
  );
}
