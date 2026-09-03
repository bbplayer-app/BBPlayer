-- +goose Up
-- Request telemetry is intentionally stored as bounded time buckets rather than
-- one raw row per delivery. The latter grows with traffic and makes dashboard
-- reads contend with update delivery.
CREATE TABLE service_metric_minutes (
    minute timestamptz NOT NULL,
    route text NOT NULL,
    status integer NOT NULL,
    request_count bigint NOT NULL DEFAULT 0,
    duration_ms bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (minute, route, status)
);

CREATE TABLE delivery_metric_minutes (
    minute timestamptz NOT NULL,
    channel text NOT NULL,
    runtime_version text NOT NULL,
    platform text NOT NULL,
    group_id uuid NOT NULL,
    kind text NOT NULL,
    outcome text NOT NULL,
    request_count bigint NOT NULL DEFAULT 0,
    byte_count bigint NOT NULL DEFAULT 0,
    target_byte_count bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (minute, channel, runtime_version, platform, group_id, kind, outcome)
);

CREATE INDEX update_events_activity_time ON update_events (channel, occurred_at, installation_hmac);
CREATE INDEX update_events_version_time ON update_events (channel, client_version, client_build_version, occurred_at);

-- +goose Down
DROP TABLE IF EXISTS delivery_metric_minutes, service_metric_minutes;
DROP INDEX IF EXISTS update_events_activity_time, update_events_version_time;
