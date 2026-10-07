// src/types/next-auth.d.ts
import "next-auth";
declare module "next-auth" {
  interface Session { user: { id: string; name?: string; email?: string; role: "superadmin" | "admin" | "user" } }
  interface User { id: string; role: "superadmin" | "admin" | "user" }
}
declare module "next-auth/jwt" {
  interface JWT { role?: "superadmin" | "admin" | "user" }
}
