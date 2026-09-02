-- +goose Up
-- A worker can be interrupted after claiming a job but before it writes a
-- terminal status. A lease lets another worker safely reclaim that job later.
ALTER TABLE patches ADD COLUMN processing_started_at timestamptz;
CREATE INDEX patches_claimable ON patches (created_at) WHERE status IN ('pending', 'processing');

-- +goose Down
DROP INDEX IF EXISTS patches_claimable;
ALTER TABLE patches DROP COLUMN IF EXISTS processing_started_at;
