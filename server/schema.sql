PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Reference snapshot only. Runtime schema changes are applied from server/migrations.
CREATE TABLE IF NOT EXISTS users (
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
  CHECK (role = 'student' OR (email IS NOT NULL AND length(trim(email)) > 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users(email COLLATE NOCASE) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS content_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  page_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS content_lookup_idx ON content_entries(type,page_key,status,sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS content_section_unique_idx
  ON content_entries(type,page_key,section_key);

CREATE TABLE IF NOT EXISTS gallery_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES gallery_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  alt_text TEXT NOT NULL,
  file_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','document','video','other')),
  is_public INTEGER NOT NULL DEFAULT 0,
  purpose TEXT NOT NULL DEFAULT 'cms' CHECK (purpose IN ('cms','profile-avatar')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department TEXT NOT NULL DEFAULT '',
  academic_year INTEGER CHECK (academic_year IS NULL OR academic_year BETWEEN 1 AND 6),
  github_url TEXT,
  linkedin_url TEXT,
  hackerrank_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  avatar_file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS student_profiles_directory_idx
  ON student_profiles(department,academic_year,user_id);

CREATE TABLE IF NOT EXISTS profile_skills (
  user_id TEXT NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL COLLATE NOCASE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id,skill_name)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_recent_idx ON activity_logs(created_at DESC);

-- See migration 005 for immutable file-purpose, private-publication,
-- gallery-eligibility, and avatar-assignment enforcement triggers.
