ALTER TABLE files ADD COLUMN purpose TEXT NOT NULL DEFAULT 'cms'
  CHECK (purpose IN ('cms','profile-avatar'));

-- Recognize existing private avatars before installing the enforcement triggers.
UPDATE files SET purpose='profile-avatar',is_public=0
WHERE id IN (SELECT avatar_file_id FROM student_profiles WHERE avatar_file_id IS NOT NULL)
  OR public_url LIKE '/api/members/media/%'
  OR storage_key LIKE 'profile-avatars/%';

-- Preserve an accidentally linked gallery record without publishing its private file.
UPDATE gallery_items SET file_id=NULL,status='hidden'
WHERE file_id IN (SELECT id FROM files WHERE purpose='profile-avatar');

CREATE INDEX files_purpose_idx ON files(purpose,created_at);

CREATE TRIGGER private_files_insert_guard BEFORE INSERT ON files
WHEN NEW.purpose='profile-avatar' AND NEW.is_public<>0
BEGIN SELECT RAISE(ABORT,'Private profile media cannot be public.'); END;

CREATE TRIGGER private_files_update_guard BEFORE UPDATE ON files
WHEN (NEW.purpose='profile-avatar' AND NEW.is_public<>0)
  OR NEW.purpose<>OLD.purpose
BEGIN SELECT RAISE(ABORT,'File purpose is immutable and private media cannot be public.'); END;

CREATE TRIGGER gallery_media_insert_guard BEFORE INSERT ON gallery_items
WHEN NEW.file_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM files WHERE id=NEW.file_id AND purpose='cms' AND kind='image'
)
BEGIN SELECT RAISE(ABORT,'Gallery requires a CMS image.'); END;

CREATE TRIGGER gallery_media_update_guard BEFORE UPDATE OF file_id ON gallery_items
WHEN NEW.file_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM files WHERE id=NEW.file_id AND purpose='cms' AND kind='image'
)
BEGIN SELECT RAISE(ABORT,'Gallery requires a CMS image.'); END;

CREATE TRIGGER avatar_media_insert_guard BEFORE INSERT ON student_profiles
WHEN NEW.avatar_file_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM files WHERE id=NEW.avatar_file_id AND purpose='profile-avatar' AND is_public=0
)
BEGIN SELECT RAISE(ABORT,'Avatar requires private profile media.'); END;

CREATE TRIGGER avatar_media_update_guard BEFORE UPDATE OF avatar_file_id ON student_profiles
WHEN NEW.avatar_file_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM files WHERE id=NEW.avatar_file_id AND purpose='profile-avatar' AND is_public=0
)
BEGIN SELECT RAISE(ABORT,'Avatar requires private profile media.'); END;
