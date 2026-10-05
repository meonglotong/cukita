// src/app/api/uploads/route.test.ts
import { beforeAll, it, expect, vi } from "vitest";
import { runMigrations } from "@/scripts/migrate";
import { query } from "@/lib/db";
import { POST } from "./route";
import { GET } from "../../files/[name]/route";
import { fakeUserSession } from "@/test/fixtures";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

beforeAll(async () => {
  await runMigrations();
  await query(
    `INSERT INTO users (id, email, name, password_hash, role)
     VALUES ($1, 'upload-test-user@local', 'UploadTest', 'x', 'user')
     ON CONFLICT (id) DO NOTHING`,
    [fakeUserSession.user.id]
  );
});

function pngFile(bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])) {
  return new File([bytes], "x.png", { type: "image/png" });
}

async function postForm(file: File | string) {
  const form = new FormData();
  form.append("file", file as File);
  return POST(new Request("http://t/api/uploads", { method: "POST", body: form }));
}

it("POST: saves an image and returns its /files URL (201)", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await postForm(pngFile());
  expect(res.status).toBe(201);
  const { url } = await res.json();
  expect(url).toMatch(/^\/files\/[a-f0-9-]{36}\.png$/);
});

it("GET: serves the uploaded bytes with the right content type", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await postForm(pngFile());
  const { url } = await res.json();
  const got = await GET(new Request(`http://t${url}`), { params: Promise.resolve({ name: url.slice("/files/".length) }) });
  expect(got.status).toBe(200);
  expect(got.headers.get("content-type")).toBe("image/png");
});

it("POST: rejects non-image types (400)", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const res = await postForm(new File(["hello"], "x.txt", { type: "text/plain" }));
  expect(res.status).toBe(400);
});

it("POST: rejects files over 10MB (413)", async () => {
  globalThis.__TEST_SESSION__ = fakeUserSession;
  const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
  const res = await postForm(big);
  expect(res.status).toBe(413);
});

it("GET: 404 for unknown / traversal names", async () => {
  globalThis.__TEST_SESSION__ = null;
  const ok = await GET(new Request("http://t/files/definitely-missing.png"), { params: Promise.resolve({ name: "definitely-missing.png" }) });
  expect(ok.status).toBe(404);
});

it("POST: 401 without session", async () => {
  globalThis.__TEST_SESSION__ = null;
  const res = await postForm(pngFile());
  expect(res.status).toBe(401);
});
