// src/app/api/search/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchDocs } from "@/lib/docs/service";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "login required" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });
  return NextResponse.json({ results: await searchDocs(q) });
}
