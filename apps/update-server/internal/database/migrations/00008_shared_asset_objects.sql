-- +goose Up
-- Republishing a historical update copies its asset rows onto the new update
-- while pointing at the same immutable R2 objects, so one object_key can now
-- belong to several updates. The unique constraint made every republish fail.
ALTER TABLE assets DROP CONSTRAINT assets_object_key_key;
CREATE INDEX assets_object_key ON assets (object_key);

-- +goose Down
DROP INDEX IF EXISTS assets_object_key;
ALTER TABLE assets ADD CONSTRAINT assets_object_key_key UNIQUE (object_key);
