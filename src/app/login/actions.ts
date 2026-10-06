// src/app/login/actions.ts
"use server";
import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createRateLimiter } from "@/lib/rate-limit";

// Throttle credential attempts per client IP: 5 per 60s. Argon2 makes each
// guess expensive on the server, so this mostly blocks fast online brute
// force; state is in-memory (single node) and resets on deploy.
const loginLimiter = createRateLimiter(5, 60_000);

function clientIp(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "local";
}

export async function login(formData: FormData): Promise<void> {
  const h = await headers();
  const ip = clientIp(h);
  if (!loginLimiter(ip)) {
    redirect("/login?error=rate");
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    // App Router: signIn with redirect:false throws on failure
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    console.error("login failed", e);
    redirect("/login?error=1");
  }
  redirect("/docs");
}
