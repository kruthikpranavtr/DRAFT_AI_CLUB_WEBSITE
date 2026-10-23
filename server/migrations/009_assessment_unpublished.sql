-- migration: foreign_keys_off
-- Rebuild only the assessment status check. Keep IDs, attempts, answers and indexes.
CREATE TABLE assessments_new (
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
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','unpublished','closed','archived')),
  results_published_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  selected_question_ids TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO assessments_new SELECT id,title,description,instructions,kind,bank_id,question_count,
  allow_backward,points_mode,total_points,duration_minutes,start_at,end_at,attempt_limit,
  eligibility_year,status,results_published_at,created_by,created_at,updated_at,selected_question_ids
  FROM assessments;
DROP TABLE assessments;
ALTER TABLE assessments_new RENAME TO assessments;
CREATE INDEX assessments_status_idx ON assessments(status,start_at,end_at);
