// src/app/login/actions.ts
"use server";
import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function login(formData: FormData): Promise<void> {
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
