// src/lib/guards.ts
import type { Session } from "next-auth";
import { auth } from "./auth";

export async function requireAuth(): Promise<{ session: Session } | { status: 401 }> {
  const session = await auth();
  if (!session?.user) return { status: 401 };
  return { session };
}

// admin + superadmin (superadmin is strictly more privileged)
export async function requireAdmin(): Promise<{ session: Session } | { status: 401 | 403 }> {
  const session = await auth();
  if (!session?.user) return { status: 401 };
  if (session.user.role !== "admin" && session.user.role !== "superadmin") return { status: 403 };
  return { session };
}
