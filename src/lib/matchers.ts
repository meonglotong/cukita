// src/lib/matchers.ts
const PUBLIC = ["/login", "/api/auth"];
export function isProtected(pathname: string): boolean {
  return !PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
