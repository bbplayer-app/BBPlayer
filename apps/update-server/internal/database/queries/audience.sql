-- Audience metrics are derived from installation_activity_days: one row means
-- the installation reported activity on that UTC day. Every query first
-- collapses it to distinct (installation, day) pairs, since an installation can
-- have several rows per day (one per version/update it ran).

-- name: GetAudienceDataStart :one
SELECT COALESCE(min(day), CURRENT_DATE)::date AS day FROM installation_activity_days;

-- name: GetAudienceSeries :many
-- Rolling 1/7/30-day active users without a per-day self join: each active
-- day covers [day, min(next active day, day+N)), so an installation's coverage
-- intervals never overlap and a running sum of +1/-1 edges counts it once.
WITH active AS (
  SELECT DISTINCT installation_hmac, day
  FROM installation_activity_days
  WHERE day >= sqlc.arg(start_day)::date - 29 AND day < sqlc.arg(end_day)::date
    AND (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
    AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
),
spans AS (
  SELECT day, lead(day) OVER (PARTITION BY installation_hmac ORDER BY day) AS next_day FROM active
),
edges AS (
  SELECT day AS at, 1 AS d1, 1 AS d7, 1 AS d30 FROM spans
  UNION ALL SELECT day + 1, -1, 0, 0 FROM spans
  UNION ALL SELECT LEAST(day + 7, COALESCE(next_day, day + 7)), 0, -1, 0 FROM spans
  UNION ALL SELECT LEAST(day + 30, COALESCE(next_day, day + 30)), 0, 0, -1 FROM spans
),
deltas AS (
  SELECT at, sum(d1) AS d1, sum(d7) AS d7, sum(d30) AS d30 FROM edges GROUP BY at
),
rolling AS (
  SELECT g.day::date AS day,
         sum(COALESCE(deltas.d1, 0)) OVER w AS dau,
         sum(COALESCE(deltas.d7, 0)) OVER w AS wau,
         sum(COALESCE(deltas.d30, 0)) OVER w AS mau
  FROM generate_series(sqlc.arg(start_day)::date - 29, sqlc.arg(end_day)::date - 1, interval '1 day') AS g(day)
  LEFT JOIN deltas ON deltas.at = g.day::date
  WINDOW w AS (ORDER BY g.day)
),
firsts AS (
  SELECT min(day) AS first_day
  FROM installation_activity_days
  WHERE (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
    AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
  GROUP BY installation_hmac
),
new_users AS (
  SELECT first_day, count(*) AS users FROM firsts GROUP BY first_day
)
SELECT rolling.day,
       rolling.dau::bigint AS dau,
       rolling.wau::bigint AS wau,
       rolling.mau::bigint AS mau,
       COALESCE(new_users.users, 0)::bigint AS new_users
FROM rolling
LEFT JOIN new_users ON new_users.first_day = rolling.day
WHERE rolling.day >= sqlc.arg(start_day)::date
ORDER BY rolling.day;

-- name: GetAudienceTotals :one
-- "New" means first seen within the range across all recorded history, so
-- installations active before telemetry started still count as new once.
WITH active AS (
  SELECT DISTINCT installation_hmac, day
  FROM installation_activity_days
  WHERE day >= sqlc.arg(start_day)::date AND day < sqlc.arg(end_day)::date
    AND (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
    AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
),
firsts AS (
  SELECT min(day) AS first_day
  FROM installation_activity_days
  WHERE (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
    AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
  GROUP BY installation_hmac
)
SELECT (SELECT count(DISTINCT installation_hmac) FROM active)::bigint AS active_users,
       (SELECT count(*) FROM active)::bigint AS active_user_days,
       (SELECT count(*) FROM firsts WHERE first_day >= sqlc.arg(start_day)::date AND first_day < sqlc.arg(end_day)::date)::bigint AS new_users;

-- name: ListAudienceVersions :many
-- group_id is only set for updates published to this server, so it separates
-- installations running an OTA update from those on the embedded bundle.
SELECT client_version,
       count(DISTINCT installation_hmac)::bigint AS users,
       count(DISTINCT installation_hmac) FILTER (WHERE group_id IS NOT NULL)::bigint AS ota_users
FROM installation_activity_days
WHERE day >= sqlc.arg(start_day)::date AND day < sqlc.arg(end_day)::date
  AND (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
  AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
GROUP BY client_version
ORDER BY users DESC, client_version DESC
LIMIT 12;

-- name: ListAudienceChannels :many
SELECT channel, count(DISTINCT installation_hmac)::bigint AS users
FROM installation_activity_days
WHERE day >= sqlc.arg(start_day)::date AND day < sqlc.arg(end_day)::date
  AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
GROUP BY channel
ORDER BY users DESC, channel;

-- name: ListAudienceRetention :many
-- Weekly (Monday-based) cohorts by first-seen day, and how many of each cohort
-- were active N weeks later. week_offset 0 is the cohort size.
WITH active AS (
  SELECT DISTINCT installation_hmac, day
  FROM installation_activity_days
  WHERE (sqlc.narg(channel)::text IS NULL OR channel=sqlc.narg(channel)::text)
    AND (sqlc.narg(platform)::text IS NULL OR platform=sqlc.narg(platform)::text)
),
cohorts AS (
  SELECT installation_hmac, date_trunc('week', min(day))::date AS cohort
  FROM active
  GROUP BY installation_hmac
  HAVING min(day) >= sqlc.arg(since_day)::date AND min(day) < sqlc.arg(end_day)::date
)
SELECT cohorts.cohort,
       ((date_trunc('week', active.day)::date - cohorts.cohort) / 7)::int AS week_offset,
       count(DISTINCT active.installation_hmac)::bigint AS users
FROM cohorts
JOIN active USING (installation_hmac)
WHERE active.day < sqlc.arg(end_day)::date
GROUP BY cohorts.cohort, week_offset
ORDER BY cohorts.cohort, week_offset;
