-- +goose Up
DROP TABLE IF EXISTS daily_update_metrics;

-- +goose Down
CREATE TABLE daily_update_metrics (day date NOT NULL, channel text NOT NULL, runtime_version text NOT NULL, platform text NOT NULL, group_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000', event_type text NOT NULL, event_count bigint NOT NULL, unique_installations bigint NOT NULL, PRIMARY KEY (day, channel, runtime_version, platform, group_id, event_type));
