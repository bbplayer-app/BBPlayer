-- +goose Up
-- Republishing a historical OTA update creates a new, later update group while
-- reusing the selected update's immutable asset objects. Keep that source
-- update ID so operators can distinguish it from a normal publication.
ALTER TABLE update_groups
  ADD COLUMN republished_from_update_id uuid REFERENCES updates(id);

-- +goose Down
ALTER TABLE update_groups
  DROP COLUMN republished_from_update_id;
