CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'user')),
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
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL UNIQUE,
  ext                  text NOT NULL,
  current_version_id   uuid,
  created_by           uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id      uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  storage_path text NOT NULL,
  size         bigint NOT NULL,
  sha256       text NOT NULL,
  note         text,
  uploaded_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_id, version)
);

CREATE INDEX IF NOT EXISTS idx_files_current ON files (current_version_id);
CREATE INDEX IF NOT EXISTS idx_doc_pages_parent ON doc_pages (parent_id, position);

ALTER TABLE files
  DROP CONSTRAINT IF EXISTS files_current_version_id_fkey;
ALTER TABLE files
  ADD CONSTRAINT files_current_version_id_fkey
  FOREIGN KEY (current_version_id) REFERENCES file_versions(id) ON DELETE SET NULL;
