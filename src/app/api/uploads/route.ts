// src/app/api/uploads/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
import { saveUpload } from "@/lib/files";

export async function POST(req: Request) {
  const g = await requireAuth();
  if ("status" in g) return NextResponse.json({ error: "login required" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  try {
    const url = await saveUpload(file);
    return NextResponse.json({ url }, { status: 201 });
  } catch (e) {
    const code = (e as { code?: string }).code;
    return NextResponse.json({ error: code ?? String(e) }, { status: code === "TOO_LARGE" ? 413 : 400 });
  }
}
