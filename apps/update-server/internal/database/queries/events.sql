-- name: InsertClientEvent :exec
INSERT INTO update_events(id,schema_version,event_type,occurred_at,installation_hmac,client_version,client_build_version,expo_updates_version,updates_protocol_version,platform,runtime_version,channel,update_id,embedded_update_id,group_id,launch_source,payload)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
ON CONFLICT(id) DO NOTHING;

-- name: InsertServerEvent :exec
INSERT INTO update_events(id,schema_version,event_type,occurred_at,platform,runtime_version,channel,group_id,payload)
VALUES(gen_random_uuid(),1,$1,now(),$2,$3,$4,$5,$6);

-- name: CountEventsByID :one
SELECT count(*) AS event_count FROM update_events WHERE id=$1;

-- name: ListEventInsights :many
SELECT event_type,count(*) AS event_count,count(DISTINCT installation_hmac) AS unique_installations
FROM update_events
WHERE occurred_at >= now()-interval '7 days'
  AND (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
  AND (sqlc.narg(runtime_version)::text IS NULL OR runtime_version=sqlc.narg(runtime_version)::text)
  AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
  AND (sqlc.narg(group_id)::uuid IS NULL OR group_id=sqlc.narg(group_id)::uuid)
GROUP BY event_type ORDER BY event_type;

-- name: GetEventInsightSummary :one
SELECT count(DISTINCT installation_hmac) AS unique_installations,count(*) FILTER (WHERE event_type LIKE 'update_check%') AS update_checks,count(*) FILTER (WHERE event_type LIKE 'download%') AS downloads,count(*) FILTER (WHERE event_type='launch_started') AS launches,count(*) FILTER (WHERE event_type='launch_succeeded') AS launch_successes,count(*) FILTER (WHERE event_type IN ('launch_failed','error_recovery')) AS launch_failures,count(*) FILTER (WHERE event_type='emergency_launch') AS emergency_launches
FROM update_events
WHERE occurred_at >= now()-interval '7 days'
  AND (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
  AND (sqlc.narg(runtime_version)::text IS NULL OR runtime_version=sqlc.narg(runtime_version)::text)
  AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
  AND (sqlc.narg(group_id)::uuid IS NULL OR group_id=sqlc.narg(group_id)::uuid);
