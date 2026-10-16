-- AI Club Member Platform - Full PostgreSQL Initial Schema
-- Preserves complete data integrity, constraints, triggers and indexing.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Identity & Permissions
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  email TEXT,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','student')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  password_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role = 'student' OR (email IS NOT NULL AND length(trim(email)) > 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_member_id_unique_idx ON users (LOWER(member_id));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

-- CMS & Site Content
CREATE TABLE IF NOT EXISTS content_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  page_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS content_lookup_idx ON content_entries (type, page_key, status, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS content_section_unique_idx ON content_entries (type, page_key, section_key);

CREATE TABLE IF NOT EXISTS gallery_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS gallery_categories_name_idx ON gallery_categories (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS gallery_categories_slug_idx ON gallery_categories (LOWER(slug));

-- Files & Storage
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','document','video','other')),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  purpose TEXT NOT NULL DEFAULT 'cms' CHECK (purpose IN ('cms','profile-avatar')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS files_purpose_idx ON files (purpose, created_at);

CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES gallery_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  alt_text TEXT NOT NULL,
  file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- Member Profiles
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department TEXT NOT NULL DEFAULT '',
  academic_year INTEGER CHECK (academic_year IS NULL OR (academic_year >= 1 AND academic_year <= 6)),
  github_url TEXT,
  linkedin_url TEXT,
  hackerrank_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  avatar_file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS student_profiles_directory_idx ON student_profiles (department, academic_year, user_id);

CREATE TABLE IF NOT EXISTS profile_skills (
  user_id TEXT NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, skill_name)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_recent_idx ON activity_logs (created_at DESC);

-- Assessment Engine
CREATE TABLE IF NOT EXISTS assessment_banks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  academic_year INTEGER CHECK (academic_year IS NULL OR (academic_year >= 1 AND academic_year <= 6)),
  batch TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assessment_banks_year_idx ON assessment_banks (academic_year, batch);

CREATE TABLE IF NOT EXISTS assessment_bank_questions (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL REFERENCES assessment_banks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'mcq' CHECK (kind IN ('mcq','coding')),
  prompt TEXT NOT NULL,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option INTEGER CHECK (correct_option IS NULL OR (correct_option >= 0 AND correct_option <= 3)),
  points REAL NOT NULL DEFAULT 1 CHECK (points > 0),
  language TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assessment_bank_questions_bank_idx ON assessment_bank_questions (bank_id, created_at);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('mcq','coding')),
  bank_id TEXT REFERENCES assessment_banks(id) ON DELETE SET NULL,
  question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 200),
  selected_question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  allow_backward BOOLEAN NOT NULL DEFAULT TRUE,
  points_mode TEXT NOT NULL CHECK (points_mode IN ('equal','custom')),
  total_points REAL NOT NULL CHECK (total_points > 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 360),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  attempt_limit INTEGER NOT NULL DEFAULT 1 CHECK (attempt_limit BETWEEN 1 AND 10),
  eligibility_year INTEGER CHECK (eligibility_year IS NULL OR (eligibility_year >= 1 AND eligibility_year <= 6)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed','archived')),
  results_published_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assessments_status_idx ON assessments (status, start_at, end_at);

CREATE TABLE IF NOT EXISTS assessment_questions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  source_question_id TEXT REFERENCES assessment_bank_questions(id) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mcq','coding')),
  prompt TEXT NOT NULL,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option INTEGER CHECK (correct_option IS NULL OR (correct_option >= 0 AND correct_option <= 3)),
  points REAL NOT NULL CHECK (points > 0),
  language TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  UNIQUE (assessment_id, position)
);
CREATE INDEX IF NOT EXISTS assessment_questions_assessment_idx ON assessment_questions (assessment_id, position);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted')),
  furthest_position INTEGER NOT NULL DEFAULT 0,
  score REAL,
  graded_at TIMESTAMPTZ,
  UNIQUE (assessment_id, student_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS assessment_attempts_student_idx ON assessment_attempts (student_id, assessment_id);
CREATE INDEX IF NOT EXISTS assessment_attempts_assessment_idx ON assessment_attempts (assessment_id, status);

CREATE TABLE IF NOT EXISTS assessment_answers (
  attempt_id TEXT NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  selected_option INTEGER CHECK (selected_option IS NULL OR (selected_option >= 0 AND selected_option <= 3)),
  code_answer TEXT NOT NULL DEFAULT '',
  awarded_points REAL CHECK (awarded_points IS NULL OR awarded_points >= 0),
  feedback TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attempt_id, question_id)
);

-- Member Community
CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
  body TEXT NOT NULL,
  tag TEXT NOT NULL,
  link_url TEXT,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed','deleted')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  pinned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS community_posts_feed_idx ON community_posts (status, is_pinned, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS community_posts_tag_idx ON community_posts (status, tag, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS community_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  parent_id TEXT,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  depth INTEGER NOT NULL CHECK (depth BETWEEN 0 AND 2),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  UNIQUE (id, post_id),
  FOREIGN KEY (parent_id, post_id) REFERENCES community_comments (id, post_id),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX IF NOT EXISTS community_comments_tree_idx ON community_comments (post_id, parent_id, created_at, id);
CREATE INDEX IF NOT EXISTS community_comments_visible_idx ON community_comments (post_id, status);

CREATE TABLE IF NOT EXISTS community_post_votes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS community_post_votes_target_idx ON community_post_votes (post_id);

CREATE TABLE IF NOT EXISTS community_comment_votes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (user_id, comment_id)
);
CREATE INDEX IF NOT EXISTS community_comment_votes_target_idx ON community_comment_votes (comment_id);

CREATE TABLE IF NOT EXISTS community_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  post_id TEXT REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES community_comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  moderator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CHECK (((post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS community_reports_post_unique ON community_reports (reporter_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS community_reports_comment_unique ON community_reports (reporter_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_reports_queue_idx ON community_reports (status, created_at, id);

-- Community Private Media
CREATE TABLE IF NOT EXISTS community_media (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'staged' CHECK (state IN ('staged','attached','detached')),
  size BIGINT NOT NULL CHECK (size > 0),
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS community_media_staging_idx ON community_media (state, expires_at);
CREATE INDEX IF NOT EXISTS community_media_owner_idx ON community_media (owner_id, state);

CREATE TABLE IF NOT EXISTS community_media_variants (
  media_id TEXT NOT NULL REFERENCES community_media(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('image','thumbnail')),
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type = 'image/webp'),
  size BIGINT NOT NULL,
  PRIMARY KEY (media_id, variant)
);

CREATE TABLE IF NOT EXISTS community_post_attachments (
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL UNIQUE REFERENCES community_media(id),
  sort_order INTEGER NOT NULL CHECK (sort_order BETWEEN 0 AND 3),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
  PRIMARY KEY (post_id, media_id),
  UNIQUE (post_id, sort_order)
);

-- Integrity Triggers in PL/pgSQL
CREATE OR REPLACE FUNCTION fn_private_files_guard() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.purpose = 'profile-avatar' AND NEW.is_public IS TRUE THEN
    RAISE EXCEPTION 'Private profile media cannot be public.';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.purpose <> OLD.purpose THEN
    RAISE EXCEPTION 'File purpose is immutable and private media cannot be public.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS private_files_insert_guard ON files;
CREATE TRIGGER private_files_insert_guard BEFORE INSERT ON files
  FOR EACH ROW EXECUTE FUNCTION fn_private_files_guard();

DROP TRIGGER IF EXISTS private_files_update_guard ON files;
CREATE TRIGGER private_files_update_guard BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION fn_private_files_guard();

CREATE OR REPLACE FUNCTION fn_gallery_media_guard() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.file_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM files WHERE id = NEW.file_id AND purpose = 'cms' AND kind = 'image'
    ) THEN
      RAISE EXCEPTION 'Gallery requires a CMS image.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gallery_media_insert_guard ON gallery_items;
CREATE TRIGGER gallery_media_insert_guard BEFORE INSERT ON gallery_items
  FOR EACH ROW EXECUTE FUNCTION fn_gallery_media_guard();

DROP TRIGGER IF EXISTS gallery_media_update_guard ON gallery_items;
CREATE TRIGGER gallery_media_update_guard BEFORE UPDATE OF file_id ON gallery_items
  FOR EACH ROW EXECUTE FUNCTION fn_gallery_media_guard();

CREATE OR REPLACE FUNCTION fn_avatar_media_guard() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.avatar_file_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM files WHERE id = NEW.avatar_file_id AND purpose = 'profile-avatar' AND is_public IS FALSE
    ) THEN
      RAISE EXCEPTION 'Avatar requires private profile media.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS avatar_media_insert_guard ON student_profiles;
CREATE TRIGGER avatar_media_insert_guard BEFORE INSERT ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_avatar_media_guard();

DROP TRIGGER IF EXISTS avatar_media_update_guard ON student_profiles;
CREATE TRIGGER avatar_media_update_guard BEFORE UPDATE OF avatar_file_id ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_avatar_media_guard();

CREATE OR REPLACE FUNCTION fn_community_comment_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_id IS NULL AND NEW.depth <> 0 THEN
      RAISE EXCEPTION 'Invalid comment ancestry.';
    ELSIF NEW.parent_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM community_comments p
        WHERE p.id = NEW.parent_id AND p.post_id = NEW.post_id AND NEW.depth = p.depth + 1
      ) THEN
        RAISE EXCEPTION 'Invalid comment ancestry.';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.post_id <> OLD.post_id OR NEW.depth <> OLD.depth THEN
      RAISE EXCEPTION 'Comment ancestry is immutable.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS community_comment_parent_guard ON community_comments;
CREATE TRIGGER community_comment_parent_guard BEFORE INSERT ON community_comments
  FOR EACH ROW EXECUTE FUNCTION fn_community_comment_guard();

DROP TRIGGER IF EXISTS community_comment_ancestry_immutable ON community_comments;
CREATE TRIGGER community_comment_ancestry_immutable BEFORE UPDATE OF parent_id, post_id, depth ON community_comments
  FOR EACH ROW EXECUTE FUNCTION fn_community_comment_guard();

CREATE OR REPLACE FUNCTION fn_community_attachment_owner_guard() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM community_posts p
    JOIN community_media m ON m.id = NEW.media_id
    WHERE p.id = NEW.post_id AND p.author_id = m.owner_id AND m.state IN ('staged', 'attached')
  ) THEN
    RAISE EXCEPTION 'Attachment ownership mismatch.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS community_attachment_owner_guard ON community_post_attachments;
CREATE TRIGGER community_attachment_owner_guard BEFORE INSERT ON community_post_attachments
  FOR EACH ROW EXECUTE FUNCTION fn_community_attachment_owner_guard();
