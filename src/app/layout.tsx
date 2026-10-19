import type { Metadata } from "next";
import "./globals.css";
import { ThemeSync } from "@/components/ThemeSync";

export const metadata: Metadata = {
  title: "Gnosis",
  description:
    "Gnosis — Knowledge base tim: panduan, runbook, dan dokumentasi operasional numpuk di satu tempat.",
};

// Applies the stored (or system) theme before first paint so there is no
// flash of the wrong theme. Mirrors resolveInitialTheme in src/lib/theme.ts.
const themePrePaint = `(function(){try{var s=localStorage.getItem("gnosis-theme");var t=(s==="light"||s==="dark")?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themePrePaint }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,300..800&display=swap"
          rel="stylesheet"
        />
        {/* Orbitron: font wordmark Gnosis — dekat dengan font logo (geometris/futuristik) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
