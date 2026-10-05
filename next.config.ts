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
};
export default nextConfig;
