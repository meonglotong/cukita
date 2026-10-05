// src/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const user = req.auth?.user;
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return;
});

export const config = { matcher: ["/docs/:path*", "/files/:path*", "/admin/:path*"] };
