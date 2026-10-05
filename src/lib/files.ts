// src/lib/files.ts
// Disk storage for user-uploaded images (editor paste/drag).
// Files land in FILES_DIR (VM: /var/lib/teamkb/files, dev: .data/uploads),
// named <uuid>.<ext> — unguessable and structurally free of path traversal.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const TYPES: Record<string, { ext: string; mime: string }> = {
  "image/png": { ext: "png", mime: "image/png" },
  "image/jpeg": { ext: "jpg", mime: "image/jpeg" },
  "image/gif": { ext: "gif", mime: "image/gif" },
  "image/webp": { ext: "webp", mime: "image/webp" },
  "image/svg+xml": { ext: "svg", mime: "image/svg+xml" },
};

export function uploadsDir(): string {
  return process.env.FILES_DIR ?? path.join(process.cwd(), ".data", "uploads");
}

export async function saveUpload(file: File): Promise<string> {
  const t = TYPES[file.type];
  if (!t) throw Object.assign(new Error("unsupported file type"), { code: "BAD_TYPE" });
  if (file.size > MAX_UPLOAD_SIZE) throw Object.assign(new Error("file too large"), { code: "TOO_LARGE" });
  const name = `${randomUUID()}.${t.ext}`;
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(path.join(uploadsDir(), name), Buffer.from(await file.arrayBuffer()));
  return `/files/${name}`;
}

export async function readUpload(name: string): Promise<{ bytes: Buffer; mime: string } | null> {
  // Only <36-hex-dash>.<ext> — anything else is a 404 before touching the disk.
  const m = name.match(/^([a-f0-9-]{36})\.([a-z]+)$/);
  if (!m) return null;
  const mime = Object.values(TYPES).find((t) => t.ext === m[2])?.mime;
  if (!mime) return null;
  try {
    const bytes = await readFile(path.join(uploadsDir(), name));
    return { bytes, mime };
  } catch {
    return null;
  }
}
