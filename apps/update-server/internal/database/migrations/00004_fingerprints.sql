-- +goose Up
ALTER TABLE update_groups
  ADD COLUMN fingerprint_hash text,
  ADD COLUMN fingerprint_sources jsonb;

CREATE INDEX update_groups_fingerprint_hash ON update_groups(fingerprint_hash);

-- +goose Down
DROP INDEX IF EXISTS update_groups_fingerprint_hash;
ALTER TABLE update_groups
  DROP COLUMN IF EXISTS fingerprint_sources,
  DROP COLUMN IF EXISTS fingerprint_hash;
