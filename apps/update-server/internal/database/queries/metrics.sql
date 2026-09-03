-- name: RollupDailyMetrics :exec
INSERT INTO daily_update_metrics(day,channel,runtime_version,platform,group_id,event_type,event_count,unique_installations) SELECT occurred_at::date,COALESCE(channel,''),COALESCE(runtime_version,''),COALESCE(platform,''),COALESCE(group_id,'00000000-0000-0000-0000-000000000000'::uuid),event_type,count(*),count(DISTINCT installation_hmac) FROM update_events WHERE occurred_at::date>=current_date-1 GROUP BY 1,2,3,4,5,6 ON CONFLICT(day,channel,runtime_version,platform,group_id,event_type) DO UPDATE SET event_count=excluded.event_count,unique_installations=excluded.unique_installations;

-- name: RecordServiceMetric :exec
INSERT INTO service_metric_minutes(minute,route,status,request_count,duration_ms)
VALUES(date_trunc('minute', now()), $1, $2, 1, $3)
ON CONFLICT(minute,route,status) DO UPDATE
SET request_count=service_metric_minutes.request_count+1,
    duration_ms=service_metric_minutes.duration_ms+excluded.duration_ms;

-- name: RecordDeliveryMetric :exec
INSERT INTO delivery_metric_minutes(minute,channel,runtime_version,platform,group_id,kind,outcome,request_count,byte_count,target_byte_count)
VALUES(date_trunc('minute', now()), $1, $2, $3, $4, $5, $6, 1, $7, $8)
ON CONFLICT(minute,channel,runtime_version,platform,group_id,kind,outcome) DO UPDATE
SET request_count=delivery_metric_minutes.request_count+1,
    byte_count=delivery_metric_minutes.byte_count+excluded.byte_count,
    target_byte_count=delivery_metric_minutes.target_byte_count+excluded.target_byte_count;

-- name: GetServiceMetricSeries :many
SELECT minute,
       sum(request_count)::bigint AS request_count,
       COALESCE(sum(request_count) FILTER (WHERE status >= 500), 0)::bigint AS error_count,
       COALESCE(sum(duration_ms), 0)::bigint AS duration_ms
FROM service_metric_minutes
WHERE minute >= $1 AND minute < $2
  AND (sqlc.narg(route)::text IS NULL OR route=sqlc.narg(route)::text)
GROUP BY minute
ORDER BY minute;

-- name: GetDeliveryMetricSeries :many
SELECT minute::date AS day,
       kind,
       outcome,
       sum(request_count)::bigint AS request_count,
       sum(byte_count)::bigint AS byte_count,
       sum(target_byte_count)::bigint AS target_byte_count
FROM delivery_metric_minutes
WHERE minute >= $1 AND minute < $2
  AND (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
  AND (sqlc.narg(runtime_version)::text IS NULL OR runtime_version=sqlc.narg(runtime_version)::text)
  AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
  AND (sqlc.narg(group_id)::uuid IS NULL OR group_id=sqlc.narg(group_id)::uuid)
GROUP BY day,kind,outcome
ORDER BY day,kind,outcome;

-- name: GetTransportInsightSummary :one
SELECT COALESCE(sum(request_count) FILTER (WHERE kind='patch' AND outcome='served'),0)::bigint AS patch_requests,
       COALESCE(sum(request_count) FILTER (WHERE kind='patch_fallback'),0)::bigint AS patch_fallbacks,
       COALESCE(sum(request_count) FILTER (WHERE kind='launch_bundle' AND outcome='served'),0)::bigint AS full_requests,
       COALESCE(sum(byte_count) FILTER (WHERE kind='patch' AND outcome='served'),0)::bigint AS patch_bytes,
       COALESCE(sum(target_byte_count) FILTER (WHERE kind='patch' AND outcome='served'),0)::bigint AS patch_target_bytes,
       COALESCE(sum(byte_count) FILTER (WHERE kind='launch_bundle' AND outcome='served'),0)::bigint AS full_bytes
FROM delivery_metric_minutes
WHERE minute >= now()-interval '7 days'
  AND (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
  AND (sqlc.narg(runtime_version)::text IS NULL OR runtime_version=sqlc.narg(runtime_version)::text)
  AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
  AND (sqlc.narg(group_id)::uuid IS NULL OR group_id=sqlc.narg(group_id)::uuid);

-- name: DeleteExpiredRawEvents :exec
DELETE FROM update_events WHERE created_at < now()-interval '35 days';

-- name: DeleteExpiredServiceMetrics :exec
DELETE FROM service_metric_minutes WHERE minute < now()-interval '90 days';

-- name: DeleteExpiredDeliveryMetrics :exec
DELETE FROM delivery_metric_minutes WHERE minute < now()-interval '90 days';

-- name: RecordInstallationActivity :exec
INSERT INTO installation_activity_days(day,installation_hmac,channel,runtime_version,platform,client_version,client_build_version,update_id,group_id,first_seen_at,last_seen_at)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
ON CONFLICT(day,installation_hmac,channel,runtime_version,platform,client_version,client_build_version,update_id) DO UPDATE
SET last_seen_at=GREATEST(installation_activity_days.last_seen_at, excluded.last_seen_at),
    group_id=COALESCE(excluded.group_id, installation_activity_days.group_id);

-- name: RecordKnownLaunch :exec
INSERT INTO known_update_launches(installation_hmac,update_id,group_id,channel,runtime_version,platform,confirmed_at)
VALUES($1,$2,$3,$4,$5,$6,$7)
ON CONFLICT(installation_hmac,update_id) DO NOTHING;

-- name: RecordKnownCrash :exec
INSERT INTO known_update_crashes(installation_hmac,update_id,group_id,channel,runtime_version,platform,confirmed_at)
VALUES($1,$2,$3,$4,$5,$6,$7)
ON CONFLICT(installation_hmac,update_id) DO NOTHING;

-- name: GetChannelActivitySeries :many
SELECT day, count(DISTINCT installation_hmac)::bigint AS active_installations
FROM installation_activity_days
WHERE day >= $1 AND day < $2
  AND (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
  AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
GROUP BY day
ORDER BY day;

-- name: GetVersionActivitySeries :many
SELECT day, client_version, client_build_version, count(DISTINCT installation_hmac)::bigint AS active_installations
FROM installation_activity_days
WHERE day >= $1 AND day < $2
  AND (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
  AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
GROUP BY day,client_version,client_build_version
ORDER BY day,client_version,client_build_version;

-- name: GetUpdateGroupLifecycleSeries :many
SELECT day, sum(known_launches)::bigint AS known_launches, sum(known_crashes)::bigint AS known_crashes
FROM (
  SELECT confirmed_at::date AS day, count(*)::bigint AS known_launches, 0::bigint AS known_crashes
  FROM known_update_launches
  WHERE known_update_launches.group_id=$1 AND known_update_launches.confirmed_at >= $2 AND known_update_launches.confirmed_at < $3
  GROUP BY 1
  UNION ALL
  SELECT confirmed_at::date AS day, 0::bigint AS known_launches, count(*)::bigint AS known_crashes
  FROM known_update_crashes
  WHERE known_update_crashes.group_id=$1 AND known_update_crashes.confirmed_at >= $2 AND known_update_crashes.confirmed_at < $3
  GROUP BY 1
) lifecycle
GROUP BY day
ORDER BY day;
