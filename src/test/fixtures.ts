// src/test/fixtures.ts
export type TestSession = { user: { id: string; name: string; email: string; role: "admin" | "user" } };

export const fakeAdminSession: TestSession = { user: { id: "00000000-0000-0000-0000-000000000001", name: "Admin", email: "admin@test.local", role: "admin" as const } };
export const fakeUserSession: TestSession = { user: { id: "00000000-0000-0000-0000-000000000002", name: "User", email: "user@test.local", role: "user" as const } };

declare global {
  // Session the mocked `auth()` resolves to; null/undefined → unauthenticated.
  // eslint-disable-next-line no-var
  var __TEST_SESSION__: TestSession | null | undefined;
  // eslint-disable-next-line no-var
  var __FILE_ID__: string | undefined;
  // eslint-disable-next-line no-var
  var __TEST_USER__: string | undefined;
}
