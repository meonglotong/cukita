// src/types/next-auth.d.ts
import "next-auth";
declare module "next-auth" {
  interface Session { user: { id: string; name?: string; email?: string; role: "admin" | "user" } }
  interface User { id: string; role: "admin" | "user" }
}
declare module "next-auth/jwt" {
  interface JWT { role?: "admin" | "user" }
}
