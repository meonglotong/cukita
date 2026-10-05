// src/app/files/[name]/route.ts
// Serves uploaded images. URLs are unguessable uuids, so this is public.
import { NextResponse } from "next/server";
import { readUpload } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const file = await readUpload(name);
  if (!file) return new NextResponse("not found", { status: 404 });
  // copy into a fresh ArrayBuffer-backed Uint8Array: satisfies BodyInit typing
  const body = new Uint8Array(file.bytes.byteLength);
  body.set(file.bytes);
  return new NextResponse(body, {
    headers: {
      "content-type": file.mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
