-- Add three independently reviewed official metadata feeds, disabled by default.
-- Never change an existing administrator's enabled/disabled choices.
INSERT INTO news_sources (id, enabled) VALUES
  ('nasa-technology', FALSE),
  ('nist-information-technology', FALSE),
  ('nist-events', FALSE)
ON CONFLICT (id) DO NOTHING;
