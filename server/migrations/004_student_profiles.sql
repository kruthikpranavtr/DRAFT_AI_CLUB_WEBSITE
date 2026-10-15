CREATE TABLE student_profiles (
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

CREATE INDEX student_profiles_directory_idx
  ON student_profiles(department,academic_year,user_id);

CREATE TABLE profile_skills (
  user_id TEXT NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL COLLATE NOCASE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id,skill_name)
);

INSERT INTO student_profiles (user_id,created_at,updated_at)
SELECT id,created_at,updated_at FROM users WHERE role='student';
