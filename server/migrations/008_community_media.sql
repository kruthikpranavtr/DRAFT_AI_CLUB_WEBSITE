-- Separate metadata preserves the immutable CMS/avatar purpose vocabulary.
CREATE TABLE community_media (
 id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 state TEXT NOT NULL DEFAULT 'staged' CHECK(state IN ('staged','attached','detached')),
 size INTEGER NOT NULL CHECK(size>0), width INTEGER NOT NULL, height INTEGER NOT NULL,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX community_media_staging_idx ON community_media(state,expires_at);
CREATE INDEX community_media_owner_idx ON community_media(owner_id,state);
CREATE TABLE community_media_variants (
 media_id TEXT NOT NULL REFERENCES community_media(id) ON DELETE CASCADE,
 variant TEXT NOT NULL CHECK(variant IN ('image','thumbnail')), storage_key TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type='image/webp'), size INTEGER NOT NULL, PRIMARY KEY(media_id,variant)
);
CREATE TABLE community_post_attachments (
 post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
 media_id TEXT NOT NULL UNIQUE REFERENCES community_media(id),
 sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN 0 AND 3),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=300),
 PRIMARY KEY(post_id,media_id), UNIQUE(post_id,sort_order)
);
CREATE TRIGGER community_attachment_owner_guard BEFORE INSERT ON community_post_attachments
WHEN NOT EXISTS (
 SELECT 1 FROM community_posts p JOIN community_media m ON m.id=NEW.media_id
 WHERE p.id=NEW.post_id AND p.author_id=m.owner_id AND m.state IN ('staged','attached')
)
BEGIN SELECT RAISE(ABORT,'Attachment ownership mismatch.'); END;
