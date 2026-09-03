-- name: ListDashboardRuntimes :many
SELECT runtime_version, (array_agg(COALESCE(expo_config->>'version','') ORDER BY created_at DESC))[1]::text AS version, max(created_at)::timestamptz AS updated_at, count(*)::bigint AS update_count, array_agg(DISTINCT channel ORDER BY channel)::text[] AS channels FROM update_groups GROUP BY runtime_version ORDER BY max(created_at) DESC;

-- name: ListDashboardRuntimeUpdates :many
SELECT id,channel,runtime_version,COALESCE(expo_config->>'version','')::text AS app_version,message,created_at,source,fingerprint_hash FROM update_groups WHERE runtime_version=$1 ORDER BY created_at DESC;

-- name: ListDashboardChannels :many
SELECT channel, max(updated_at)::timestamptz AS updated_at, count(DISTINCT runtime_version) AS runtime_count FROM channel_heads GROUP BY channel ORDER BY channel;

-- name: ListDashboardChannelRuntimes :many
SELECT h.runtime_version, max(h.updated_at)::timestamptz AS updated_at, (array_agg(g.expo_config->>'version' ORDER BY h.updated_at DESC))[1]::text AS version, COALESCE((array_agg(h.group_id ORDER BY h.updated_at DESC))[1]::text,'')::text AS head_group_id, (array_agg(h.mode ORDER BY h.updated_at DESC))[1]::text AS mode, array_agg(h.platform ORDER BY h.platform)::text[] AS platforms FROM channel_heads h LEFT JOIN update_groups g ON g.id=h.group_id WHERE h.channel=$1 GROUP BY h.runtime_version ORDER BY max(h.updated_at) DESC;

-- name: ListDashboardActivity :many
SELECT day, COALESCE(group_id::text,'')::text AS group_id, count(DISTINCT installation_hmac)::bigint AS active_installations FROM installation_activity_days WHERE day >= $1 AND day < $2 AND channel=$3 AND runtime_version=$4 GROUP BY day, group_id ORDER BY day, group_id;

-- name: ListDashboardUpdatePlatforms :many
SELECT u.id,u.platform,u.launch_key,u.launch_hash,a.size_bytes,(SELECT count(*) FROM update_events e WHERE e.group_id=u.group_id AND e.platform=u.platform AND e.event_type='download_succeeded') AS downloads,(SELECT count(*) FROM known_update_launches l WHERE l.group_id=u.group_id AND l.platform=u.platform) AS known_launches,(SELECT count(*) FROM known_update_crashes c WHERE c.group_id=u.group_id AND c.platform=u.platform) AS known_crashes FROM updates u JOIN assets a ON a.update_id=u.id AND a.is_launch WHERE u.group_id=$1 ORDER BY u.platform;

-- name: ListDashboardUpdateAssets :many
SELECT a.id,a.asset_key,a.content_type,a.size_bytes,a.is_launch,COALESCE((SELECT count(*) FROM update_events e WHERE e.update_id=u.id AND e.event_type='download_succeeded'),0)::bigint AS downloads FROM updates u JOIN assets a ON a.update_id=u.id WHERE u.group_id=$1 AND u.platform=$2 ORDER BY a.is_launch DESC,a.size_bytes DESC;
