// Stub for @node-rs/argon2 in the Edge (middleware) / client bundle.
// The Credentials `authorize()` callback is only invoked by the Node sign-in
// route, never by the Edge middleware (which only decodes JWTs), so argon2
// must not be evaluated there — its native/WASM build is not Edge-compatible.
function unavailable() {
  return Promise.reject(new Error("@node-rs/argon2 is unavailable in the Edge runtime"));
}
module.exports = { hash: unavailable, verify: unavailable };
