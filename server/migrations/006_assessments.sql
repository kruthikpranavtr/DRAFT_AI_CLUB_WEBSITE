-- Phase 4: isolated assessment tables. Published question snapshots never depend on bank edits.
CREATE TABLE assessment_banks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  academic_year INTEGER CHECK (academic_year IS NULL OR academic_year BETWEEN 1 AND 6),
  batch TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX assessment_banks_year_idx ON assessment_banks(academic_year,batch);

CREATE TABLE assessment_bank_questions (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL REFERENCES assessment_banks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'mcq' CHECK(kind IN ('mcq','coding')),
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_option INTEGER CHECK(correct_option IS NULL OR correct_option BETWEEN 0 AND 3),
  points REAL NOT NULL DEFAULT 1 CHECK(points > 0),
  language TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX assessment_bank_questions_bank_idx ON assessment_bank_questions(bank_id,created_at);

CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK(kind IN ('mcq','coding')),
  bank_id TEXT REFERENCES assessment_banks(id) ON DELETE SET NULL,
  question_count INTEGER NOT NULL CHECK(question_count BETWEEN 1 AND 200),
  allow_backward INTEGER NOT NULL DEFAULT 1 CHECK(allow_backward IN (0,1)),
  points_mode TEXT NOT NULL CHECK(points_mode IN ('equal','custom')),
  total_points REAL NOT NULL CHECK(total_points > 0),
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 1 AND 360),
  start_at TEXT,
  end_at TEXT,
  attempt_limit INTEGER NOT NULL DEFAULT 1 CHECK(attempt_limit BETWEEN 1 AND 10),
  eligibility_year INTEGER CHECK(eligibility_year IS NULL OR eligibility_year BETWEEN 1 AND 6),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed','archived')),
  results_published_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX assessments_status_idx ON assessments(status,start_at,end_at);

CREATE TABLE assessment_questions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  source_question_id TEXT REFERENCES assessment_bank_questions(id) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('mcq','coding')),
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_option INTEGER CHECK(correct_option IS NULL OR correct_option BETWEEN 0 AND 3),
  points REAL NOT NULL CHECK(points > 0),
  language TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  UNIQUE(assessment_id,position)
);
CREATE INDEX assessment_questions_assessment_idx ON assessment_questions(assessment_id,position);

CREATE TABLE assessment_attempts (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK(attempt_number > 0),
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted')),
  furthest_position INTEGER NOT NULL DEFAULT 0,
  score REAL,
  graded_at TEXT,
  UNIQUE(assessment_id,student_id,attempt_number)
);
CREATE INDEX assessment_attempts_student_idx ON assessment_attempts(student_id,assessment_id);
CREATE INDEX assessment_attempts_assessment_idx ON assessment_attempts(assessment_id,status);

CREATE TABLE assessment_answers (
  attempt_id TEXT NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  selected_option INTEGER CHECK(selected_option IS NULL OR selected_option BETWEEN 0 AND 3),
  code_answer TEXT NOT NULL DEFAULT '',
  awarded_points REAL CHECK(awarded_points IS NULL OR awarded_points >= 0),
  feedback TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(attempt_id,question_id)
);

ALTER TABLE assessments ADD COLUMN selected_question_ids TEXT NOT NULL DEFAULT '[]';
