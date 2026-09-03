-- +goose Up
-- One row represents one observed installation/version/day. It lets dashboard
-- charts count active installations without scanning the raw event stream.
CREATE TABLE installation_activity_days (
    day date NOT NULL,
    installation_hmac text NOT NULL,
    channel text NOT NULL,
    runtime_version text NOT NULL,
    platform text NOT NULL,
    client_version text NOT NULL,
    client_build_version text NOT NULL,
    update_id uuid NOT NULL,
    group_id uuid,
    first_seen_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    PRIMARY KEY (day, installation_hmac, channel, runtime_version, platform, client_version, client_build_version, update_id)
);
CREATE INDEX installation_activity_channel_day ON installation_activity_days (channel, day);
CREATE INDEX installation_activity_group_day ON installation_activity_days (group_id, day);

-- These sets deliberately make launch and crash metrics conservative: an
-- installation can contribute only once for a particular update.
CREATE TABLE known_update_launches (
    installation_hmac text NOT NULL,
    update_id uuid NOT NULL,
    group_id uuid,
    channel text NOT NULL,
    runtime_version text NOT NULL,
    platform text NOT NULL,
    confirmed_at timestamptz NOT NULL,
    PRIMARY KEY (installation_hmac, update_id)
);
CREATE INDEX known_update_launches_group_time ON known_update_launches (group_id, confirmed_at);

CREATE TABLE known_update_crashes (
    installation_hmac text NOT NULL,
    update_id uuid NOT NULL,
    group_id uuid,
    channel text NOT NULL,
    runtime_version text NOT NULL,
    platform text NOT NULL,
    confirmed_at timestamptz NOT NULL,
    PRIMARY KEY (installation_hmac, update_id)
);
CREATE INDEX known_update_crashes_group_time ON known_update_crashes (group_id, confirmed_at);

-- +goose Down
DROP TABLE IF EXISTS known_update_crashes, known_update_launches, installation_activity_days;
