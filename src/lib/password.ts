import { hash, verify } from "@node-rs/argon2";

export function hashPassword(plain: string): Promise<string> {
  // algorithm defaults to argon2id (documented default in @node-rs/argon2)
  return hash(plain, { memoryCost: 19456, parallelism: 2, outputLen: 32 });
}

export function verifyPassword(stored: string, plain: string): Promise<boolean> {
  return verify(stored, plain);
}
