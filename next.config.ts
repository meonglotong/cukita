import type { NextConfig } from "next";
import path from "node:path";
const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config, { nextRuntime }) => {
    // @node-rs/argon2 (WASM/native) is not Edge-compatible; the middleware only
    // decodes JWTs and never runs the credentials `authorize()`, so stub it out
    // of the non-server bundles.
    if (nextRuntime === "edge") {
      config.resolve.alias["@node-rs/argon2"] = path.resolve(__dirname, "src/lib/argon2-stub.js");
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            // Defense in depth on top of the markdown sanitizer: no external
            // scripts/fonts/frames, no object/embed. 'unsafe-inline' for
            // script is required by Next's flight scripts and the pre-paint
            // theme script, so real XSS protection comes from sanitize-html.
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; img-src 'self' data:; font-src 'self' fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};
export default nextConfig;
