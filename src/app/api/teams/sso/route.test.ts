// src/app/api/teams/sso/route.test.ts
import { it, expect, vi } from "vitest";
import { POST } from "./route";

const signIn = vi.fn();
vi.mock("@/lib/auth", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));

function post(body: unknown): Promise<Response> {
  const req = new Request("http://t/api/teams/sso", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return Promise.resolve(POST(req));
}

it("400 on invalid body", async () => {
  const res = await post("{nope");
  expect(res.status).toBe(400);
  expect(signIn).not.toHaveBeenCalled();
});

it("400 when idToken missing or too short", async () => {
  expect((await post({})).status).toBe(400);
  expect((await post({ idToken: "short" })).status).toBe(400);
  expect(signIn).not.toHaveBeenCalled();
});

it("401 when the provider rejects the token", async () => {
  signIn.mockResolvedValueOnce({ error: "AccessDenied" });
  const res = await post({ idToken: "x".repeat(40) });
  expect(res.status).toBe(401);
});

it("200 + default target /docs on success", async () => {
  signIn.mockResolvedValueOnce({ error: null });
  const res = await post({ idToken: "x".repeat(40) });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, redirectTo: "/docs" });
  expect(signIn).toHaveBeenCalledWith(
    "microsoft-entra-id",
    expect.objectContaining({ redirect: false, callbackUrl: "/docs" })
  );
});

it("respects a relative target, rejects external ones", async () => {
  signIn.mockResolvedValue({ error: null });
  expect((await post({ idToken: "x".repeat(40), target: "/docs/42" })).status).toBe(200);
  const ext = await post({ idToken: "x".repeat(40), target: "https://evil.example" });
  expect(await ext.json()).toEqual({ ok: true, redirectTo: "/docs" });
});
