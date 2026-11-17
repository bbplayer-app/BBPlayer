-- name: ListDashboardFleet :many
-- One row per channel/runtime/platform that either has a channel head or had
-- active installations in the last 7 days, so native versions without an OTA
-- update still show up.
WITH activity AS (
  SELECT channel, runtime_version, platform,
         count(DISTINCT installation_hmac) AS active_users,
         max(client_version) AS client_version
  FROM installation_activity_days
  WHERE day > CURRENT_DATE - 7
  GROUP BY channel, runtime_version, platform
),
keys AS (
  SELECT channel, runtime_version, platform FROM activity
  UNION
  SELECT channel, runtime_version, platform FROM channel_heads
)
SELECT k.channel, k.runtime_version, k.platform,
       COALESCE(a.active_users, 0)::bigint AS active_users,
       COALESCE(g.expo_config->>'version', a.client_version, '')::text AS app_version,
       COALESCE(h.mode, '')::text AS head_mode,
       h.group_id AS head_group_id,
       h.updated_at AS head_updated_at,
       COALESCE(g.message, '')::text AS head_message,
       g.created_at AS head_created_at,
       COALESCE(g.source->>'commit_sha', '')::text AS head_commit_sha,
       (SELECT count(DISTINCT d.installation_hmac) FROM installation_activity_days d
         WHERE d.day > CURRENT_DATE - 7 AND d.group_id = h.group_id AND d.channel = k.channel AND d.platform = k.platform)::bigint AS head_users,
       (SELECT count(*) FROM known_update_launches l WHERE l.group_id = h.group_id AND l.platform = k.platform)::bigint AS head_launches,
       (SELECT count(*) FROM known_update_crashes c WHERE c.group_id = h.group_id AND c.platform = k.platform)::bigint AS head_crashes
FROM keys k
LEFT JOIN activity a ON a.channel = k.channel AND a.runtime_version = k.runtime_version AND a.platform = k.platform
LEFT JOIN channel_heads h ON h.channel = k.channel AND h.runtime_version = k.runtime_version AND h.platform = k.platform
LEFT JOIN update_groups g ON g.id = h.group_id AND h.mode = 'ota'
ORDER BY active_users DESC, k.channel, k.runtime_version DESC, k.platform;

-- name: ListDashboardHistory :many
SELECT h.id, h.channel, h.runtime_version, h.platform, h.group_id, h.mode, h.action, h.created_at,
       COALESCE(g.message, '')::text AS message,
       COALESCE(g.source->>'commit_sha', '')::text AS commit_sha,
       COALESCE(g.expo_config->>'version', h.runtime_version)::text AS app_version
FROM channel_history h
LEFT JOIN update_groups g ON g.id = h.group_id
WHERE (sqlc.narg(channel)::text IS NULL OR h.channel = sqlc.narg(channel)::text)
ORDER BY h.created_at DESC, h.id DESC
LIMIT sqlc.arg(row_limit);

-- name: GetDashboardPatchAttention :one
SELECT count(*) FILTER (WHERE status = 'failed')::bigint AS failed,
       count(*) FILTER (WHERE status IN ('pending', 'processing'))::bigint AS pending
FROM patches;

-- name: ListDashboardReleases :many
SELECT g.id, g.channel, g.runtime_version,
       COALESCE(g.expo_config->>'version', '')::text AS app_version,
       g.message, g.created_at,
       COALESCE(g.source->>'commit_sha', '')::text AS commit_sha,
       (SELECT ru.group_id FROM updates ru WHERE ru.id = g.republished_from_update_id) AS republished_from_group_id,
       COALESCE((SELECT array_agg(u.platform ORDER BY u.platform) FROM updates u WHERE u.group_id = g.id), '{}')::text[] AS platforms,
       COALESCE((SELECT array_agg(h.platform ORDER BY h.platform) FROM channel_heads h WHERE h.group_id = g.id AND h.channel = g.channel AND h.mode = 'ota'), '{}')::text[] AS live_platforms,
       (SELECT count(*) FROM known_update_launches l WHERE l.group_id = g.id)::bigint AS launches,
       (SELECT count(*) FROM known_update_crashes c WHERE c.group_id = g.id)::bigint AS crashes,
       (SELECT count(DISTINCT d.installation_hmac) FROM installation_activity_days d WHERE d.group_id = g.id AND d.day > CURRENT_DATE - 7)::bigint AS active_users,
       COALESCE((SELECT sum(m.request_count) FROM delivery_metric_minutes m WHERE m.group_id = g.id AND m.outcome = 'served' AND m.kind IN ('launch_bundle', 'patch')), 0)::bigint AS downloads
FROM update_groups g
ORDER BY g.created_at DESC
LIMIT 500;

-- name: ListDashboardReleaseAdoption :many
-- Installations active each day on the release's channel and runtime, and how
-- many of them ran this release.
SELECT d.day,
       count(DISTINCT d.installation_hmac) FILTER (WHERE d.group_id = sqlc.arg(group_id)::uuid)::bigint AS release_users,
       count(DISTINCT d.installation_hmac)::bigint AS runtime_users
FROM installation_activity_days d
JOIN update_groups g ON g.id = sqlc.arg(group_id)::uuid
WHERE d.channel = g.channel AND d.runtime_version = g.runtime_version
  AND d.day >= sqlc.arg(start_day)::date AND d.day < sqlc.arg(end_day)::date
GROUP BY d.day
ORDER BY d.day;

-- name: GetDashboardPreviousRelease :one
SELECT p.id, p.message, p.created_at, COALESCE(p.source->>'commit_sha', '')::text AS commit_sha
FROM update_groups g
JOIN update_groups p ON p.channel = g.channel AND p.runtime_version = g.runtime_version AND p.created_at < g.created_at
WHERE g.id = $1
ORDER BY p.created_at DESC
LIMIT 1;

-- name: ListDashboardUpdatePlatforms :many
SELECT u.id,u.platform,u.launch_key,u.launch_hash,a.size_bytes,COALESCE((SELECT sum(m.request_count) FILTER (WHERE m.kind='launch_bundle') FROM delivery_metric_minutes m WHERE m.group_id=u.group_id AND m.platform=u.platform AND m.outcome='served'),0)::bigint AS full_downloads,COALESCE((SELECT sum(m.request_count) FILTER (WHERE m.kind='patch') FROM delivery_metric_minutes m WHERE m.group_id=u.group_id AND m.platform=u.platform AND m.outcome='served'),0)::bigint AS patch_downloads,COALESCE((SELECT sum(m.byte_count) FILTER (WHERE m.kind='patch') FROM delivery_metric_minutes m WHERE m.group_id=u.group_id AND m.platform=u.platform AND m.outcome='served'),0)::bigint AS patch_bytes,COALESCE((SELECT sum(m.target_byte_count) FILTER (WHERE m.kind='patch') FROM delivery_metric_minutes m WHERE m.group_id=u.group_id AND m.platform=u.platform AND m.outcome='served'),0)::bigint AS patch_target_bytes,(SELECT count(*) FROM known_update_launches l WHERE l.group_id=u.group_id AND l.platform=u.platform) AS known_launches,(SELECT count(*) FROM known_update_crashes c WHERE c.group_id=u.group_id AND c.platform=u.platform) AS known_crashes,EXISTS(SELECT 1 FROM channel_heads h JOIN update_groups g ON g.id=u.group_id WHERE h.group_id=u.group_id AND h.channel=g.channel AND h.platform=u.platform AND h.mode='ota') AS is_live FROM updates u JOIN assets a ON a.update_id=u.id AND a.is_launch WHERE u.group_id=$1 ORDER BY u.platform;

-- name: ListDashboardUpdatePatches :many
SELECT p.id,p.to_update_id,p.from_update_id,p.platform,p.status,p.size_bytes,p.attempts,p.served_count,p.error,p.updated_at,fu.group_id AS from_group_id,fug.message AS from_message
FROM patches p
JOIN updates tu ON tu.id=p.to_update_id
JOIN updates fu ON fu.id=p.from_update_id
JOIN update_groups fug ON fug.id=fu.group_id
WHERE tu.group_id=$1
ORDER BY p.platform,p.created_at DESC;

-- name: ListDashboardUpdateAssets :many
SELECT a.id,a.asset_key,a.content_type,a.size_bytes,a.is_launch FROM updates u JOIN assets a ON a.update_id=u.id WHERE u.group_id=$1 AND u.platform=$2 ORDER BY a.is_launch DESC,a.size_bytes DESC;
