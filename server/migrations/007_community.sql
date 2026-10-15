CREATE TABLE community_posts (
 id TEXT PRIMARY KEY, author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 180), body TEXT NOT NULL, tag TEXT NOT NULL, link_url TEXT,
 status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden','removed','deleted')),
 is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0,1)),
 is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0,1)),
 pinned_by TEXT REFERENCES users(id) ON DELETE SET NULL, pinned_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, edited_at TEXT, deleted_at TEXT
);
CREATE INDEX community_posts_feed_idx ON community_posts(status,is_pinned,created_at DESC,id DESC);
CREATE INDEX community_posts_tag_idx ON community_posts(status,tag,created_at DESC,id DESC);
CREATE TABLE community_comments (
 id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE, parent_id TEXT,
 author_id TEXT REFERENCES users(id) ON DELETE SET NULL, body TEXT NOT NULL,
 depth INTEGER NOT NULL CHECK(depth BETWEEN 0 AND 2),
 status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden','removed','deleted')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, edited_at TEXT, deleted_at TEXT,
 UNIQUE(id,post_id), FOREIGN KEY(parent_id,post_id) REFERENCES community_comments(id,post_id),
 CHECK(parent_id IS NULL OR parent_id<>id)
);
CREATE INDEX community_comments_tree_idx ON community_comments(post_id,parent_id,created_at,id);
CREATE INDEX community_comments_visible_idx ON community_comments(post_id,status);
CREATE TRIGGER community_comment_parent_guard BEFORE INSERT ON community_comments
WHEN (NEW.parent_id IS NULL AND NEW.depth<>0) OR (NEW.parent_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM community_comments p WHERE p.id=NEW.parent_id AND p.post_id=NEW.post_id AND NEW.depth=p.depth+1
))
BEGIN SELECT RAISE(ABORT,'Invalid comment ancestry.'); END;
CREATE TRIGGER community_comment_ancestry_immutable BEFORE UPDATE OF parent_id,post_id,depth ON community_comments
WHEN NEW.parent_id IS NOT OLD.parent_id OR NEW.post_id<>OLD.post_id OR NEW.depth<>OLD.depth
BEGIN SELECT RAISE(ABORT,'Comment ancestry is immutable.'); END;
CREATE TABLE community_post_votes (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
 value INTEGER NOT NULL CHECK(value IN (-1,1)), PRIMARY KEY(user_id,post_id)
);
CREATE INDEX community_post_votes_target_idx ON community_post_votes(post_id);
CREATE TABLE community_comment_votes (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 comment_id TEXT NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
 value INTEGER NOT NULL CHECK(value IN (-1,1)), PRIMARY KEY(user_id,comment_id)
);
CREATE INDEX community_comment_votes_target_idx ON community_comment_votes(comment_id);
CREATE TABLE community_reports (
 id TEXT PRIMARY KEY, reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 post_id TEXT REFERENCES community_posts(id) ON DELETE CASCADE,
 comment_id TEXT REFERENCES community_comments(id) ON DELETE CASCADE, reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
 moderator_id TEXT REFERENCES users(id) ON DELETE SET NULL, resolution TEXT, created_at TEXT NOT NULL, resolved_at TEXT,
 CHECK((post_id IS NOT NULL)+(comment_id IS NOT NULL)=1)
);
CREATE UNIQUE INDEX community_reports_post_unique ON community_reports(reporter_id,post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX community_reports_comment_unique ON community_reports(reporter_id,comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX community_reports_queue_idx ON community_reports(status,created_at,id);
