-- +goose Up
CREATE TABLE source_commits (
  update_group_id uuid NOT NULL REFERENCES update_groups(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  commit_sha text NOT NULL,
  parent_sha text,
  subject text NOT NULL,
  author_name text,
  authored_at timestamptz,
  PRIMARY KEY (update_group_id, ordinal),
  UNIQUE (update_group_id, commit_sha)
);
CREATE INDEX source_commits_sha ON source_commits(commit_sha);

CREATE TABLE daily_update_metrics (
  day date NOT NULL,
  channel text NOT NULL,
  runtime_version text NOT NULL,
  platform text NOT NULL,
  group_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  event_type text NOT NULL,
  event_count bigint NOT NULL,
  unique_installations bigint NOT NULL,
  PRIMARY KEY (day, channel, runtime_version, platform, group_id, event_type)
);

-- +goose Down
DROP TABLE IF EXISTS daily_update_metrics;
DROP TABLE IF EXISTS source_commits;
