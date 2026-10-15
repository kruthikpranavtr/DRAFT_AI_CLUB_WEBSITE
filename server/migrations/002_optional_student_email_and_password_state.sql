-- migration: foreign_keys_off
CREATE TABLE users_next (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','student')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  permissions TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(permissions) AND json_type(permissions) = 'array'),
  must_change_password INTEGER NOT NULL DEFAULT 0
    CHECK (must_change_password IN (0,1)),
  password_changed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    role = 'student'
    OR (email IS NOT NULL AND length(trim(email)) > 0)
  )
);

INSERT INTO users_next (
  id,member_id,email,name,password_hash,role,status,permissions,
  must_change_password,password_changed_at,created_at,updated_at
)
SELECT
  id,trim(member_id),NULLIF(lower(trim(email)),''),name,password_hash,role,status,
  permissions,0,NULL,created_at,updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_next RENAME TO users;
CREATE UNIQUE INDEX users_email_unique_idx
  ON users(email COLLATE NOCASE)
  WHERE email IS NOT NULL;
