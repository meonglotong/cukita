CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('superadmin', 'admin', 'user')),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doc_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES doc_pages(id) ON DELETE RESTRICT,
  position    integer NOT NULL DEFAULT 0,
  title       text NOT NULL,
  slug        text UNIQUE,
  is_section  boolean NOT NULL DEFAULT false,
  body_md     text,
  author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Existing databases: doc_pages was created without author_id (pre-ownership
-- feature). IF NOT EXISTS makes this a no-op on fresh installs.
ALTER TABLE doc_pages ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Existing databases: role check was written for (admin, user) before the
-- superadmin role existed. Rebuild it to allow all three; no-op on fresh
-- installs (where CREATE TABLE already has the 3-value check).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'admin', 'user'));

CREATE INDEX IF NOT EXISTS idx_doc_pages_parent ON doc_pages (parent_id, position);
