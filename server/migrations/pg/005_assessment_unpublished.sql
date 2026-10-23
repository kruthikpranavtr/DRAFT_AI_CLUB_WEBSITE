-- Add a reversible, student-hidden withdrawal state without touching assessment records.
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_status_check;
ALTER TABLE assessments ADD CONSTRAINT assessments_status_check
  CHECK (status IN ('draft','published','unpublished','closed','archived'));
