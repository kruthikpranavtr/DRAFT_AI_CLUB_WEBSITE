-- Additive, per-user inbox events without altering existing content or users.
-- Broadcast notifications are stored once; read state is scoped to each user.
CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('community_post','community_reply','site_update','news_update','assessment_update','direct_message')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '/notifications',
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(body) <= 800),
  CHECK (length(link) <= 512 AND left(link,1) = '/' AND left(link,2) <> '//'),
  CHECK (recipient_id IS NULL OR recipient_id <> actor_id)
);
CREATE INDEX IF NOT EXISTS notification_events_recent_idx ON notification_events (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS notification_events_recipient_idx ON notification_events (recipient_id, created_at DESC);
CREATE TABLE IF NOT EXISTS notification_reads (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS notification_reads_event_idx ON notification_reads (event_id);
