-- Additive: preserves every existing CMS entry and publication workflow.
CREATE TABLE news_sources (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO news_sources (id) VALUES ('arxiv-research'), ('google-news'), ('django'), ('devpost'), ('mlh'), ('unstop');
CREATE TABLE news_category_policies (
  category TEXT PRIMARY KEY,
  auto_publish BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO news_category_policies VALUES
  ('AI News', TRUE), ('Technology News', TRUE), ('Hackathons', FALSE), ('Events and Opportunities', FALSE);
CREATE TABLE news_details (
  content_id TEXT PRIMARY KEY REFERENCES content_entries(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES news_sources(id),
  external_id TEXT,
  canonical_url TEXT UNIQUE,
  category TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'article' CHECK (content_type IN ('article','research','hackathon','event','manual')),
  approval TEXT NOT NULL DEFAULT 'pending' CHECK (approval IN ('pending','approved','rejected')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  auto_archive BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author TEXT,
  expires_at TIMESTAMPTZ,
  opportunity JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, external_id)
);
CREATE INDEX news_moderation_idx ON news_details (approval, archived, collected_at DESC);
CREATE INDEX news_category_date_idx ON news_details (category, published_at DESC);
CREATE INDEX news_source_idx ON news_details (source_id);
CREATE TABLE news_ingestion_runs (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('admin','scheduler')),
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running','success','partial','failed','skipped')),
  results JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX news_runs_date_idx ON news_ingestion_runs (started_at DESC);
CREATE TABLE news_ingestion_leases (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
