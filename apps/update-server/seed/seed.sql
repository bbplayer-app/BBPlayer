-- BBPlayer update-server demo seed
-- Idempotent: TRUNCATE everything first, then rebuild a deterministic 30-day story:
--   3 channels x 6 runtime lines, 13 published groups, a preview crash + rollback arc,
--   ~575 unique installations across 6 native fleets, ~14k raw events.
-- Deterministic pseudo-random via md5() — reruns produce identical data.
--
-- Run (from apps/update-server):
--   docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U updates -d updates < seed/seed.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. wipe
-- ---------------------------------------------------------------------------
TRUNCATE TABLE update_groups, updates, assets, channel_heads, channel_history,
  patches, update_events, source_commits, daily_update_metrics,
  installation_activity_days, known_update_launches, known_update_crashes,
  service_metric_minutes, delivery_metric_minutes
  RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- 1. deterministic helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bb_seed_frac(t text) RETURNS numeric AS $$
  SELECT (('x' || left(md5(t), 12)))::bit(48)::bigint::numeric / 281474976710656::numeric;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION bb_seed_int(t text, lo int, hi int) RETURNS int AS $$
  SELECT lo + floor(bb_seed_frac(t) * (hi - lo))::int;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION bb_seed_day(k int) RETURNS date AS $$
  SELECT now()::date - k;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION bb_seed_sha40(t text) RETURNS text AS $$
  SELECT md5('c1:' || t) || left(md5('c2:' || t), 8);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION bb_seed_sha64(t text) RETURNS text AS $$
  SELECT md5('s1:' || t) || md5('s2:' || t);
$$ LANGUAGE sql IMMUTABLE;

-- deterministic uuid (v4-ish) from a seed string
CREATE OR REPLACE FUNCTION bb_seed_uuid(t text) RETURNS uuid AS $$
  SELECT (substr(h,1,8) || '-' || substr(h,9,4) || '-4' || substr(h,13,3) || '-' ||
          '8' || substr(h,17,3) || '-' || substr(h,20,12))::uuid
  FROM (SELECT md5('uuid:' || t) AS h) s;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION bb_seed_hmac(t text) RETURNS text AS $$
  SELECT replace(encode(digest('bbplayer-seed:' || t, 'sha256'), 'base64'), '=', '');
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- 2. publish plan (one row per update group)
--    line ids: prod-legacy / prod-r1 / prod-r2 / prev-a1 / prev-a2 / dev
--    gL0     production  k40  legacy 2.5.4 line (pre-window head, in use whole window)
--    gP1 gP2 production  k26 k19  prod-r1  (2.6.0)
--    gP3..5  production  k12 k8  k3     prod-r2  (2.6.2)
--    gV1 gV2 preview     k14 k8  prev-a1 (2.6.5-alpha.1)   gV2 crashes -> rollback to gV1
--    gW1 gW2 preview     k5  k2  prev-a2 (2.6.5-alpha.2)
--    gD0..2  development k12 k7 k2      dev     (2.6.5-alpha.2)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE t_g (
  gkey text PRIMARY KEY, chan text NOT NULL, line text NOT NULL,
  kpub int NOT NULL, msg text NOT NULL
);

INSERT INTO t_g (gkey, chan, line, kpub, msg) VALUES
  ('gL0','production','prod-legacy',40,'legacy: keep 2.5.4 installs warm while 2.6 rolls out'),
  ('gP1','production','prod-r1',26,'mobile/player/headlessTask: fix lyrics not updating in background'),
  ('gP2','production','prod-r1',19,'mobile: bump version to 2.6.0 and refresh launcher assets'),
  ('gP3','production','prod-r2',12,'mobile: release 2.6.2 with wavy seek slider'),
  ('gP4','production','prod-r2',8,'mobile/skin/appbar: use bilibili skin text color on AppBar'),
  ('gP5','production','prod-r2',3,'mobile/backup/webdav: decouple fetch/mutate to react-query'),
  ('gV1','preview','prev-a1',14,'alpha.1 baseline: queue sheet rewrite groundwork'),
  ('gV2','preview','prev-a1',8,'mobile/playerQueue: bottom-sheet queue (alpha.1 experimental)'),
  ('gW1','preview','prev-a2',5,'alpha.2: fix queue sheet crash from gV2 regressions'),
  ('gW2','preview','prev-a2',2,'alpha.2: cleanup danmaku remnants + asset pass'),
  ('gD0','development','dev',12,'dev: enable verbose telemetry + local server'),
  ('gD1','development','dev',7,'dev: log update lifecycle transitions'),
  ('gD2','development','dev',2,'dev: sync with alpha.2 line');

CREATE TEMP TABLE t_gmeta AS
SELECT g.*, md5('rv:' || g.line) AS rv, bb_seed_uuid('group:' || g.gkey) AS gid,
       bb_seed_uuid('upd:' || g.gkey || ':android') AS uid_a,
       bb_seed_uuid('upd:' || g.gkey || ':ios') AS uid_i,
       bb_seed_int('asize:' || g.gkey, 3200000, 7000000) AS abytes,
       bb_seed_int('isize:' || g.gkey, 2400000, 6500000) AS ibytes,
       (bb_seed_day(g.kpub) + make_interval(mins => bb_seed_int('pubmin:' || g.gkey, 540, 900))) AS ts
FROM t_g g;

-- ---------------------------------------------------------------------------
-- 3. update_groups
-- ---------------------------------------------------------------------------
INSERT INTO update_groups
  (id, channel, runtime_version, message, created_at, source, fingerprint_hash,
   fingerprint_sources, expo_config, metadata_sha256, status)
SELECT
  gm.gid, gm.chan, gm.rv, gm.msg, gm.ts,
  jsonb_build_object(
    'commit_sha', bb_seed_sha40('g:' || gm.gkey),
    'working_tree_clean', true,
    'repository', 'https://github.com/bbplayer-app/BBPlayer.git'
  ),
  gm.rv,
  jsonb_build_array(jsonb_build_object('type', 'fingerprint', 'identifier', gm.rv)),
  jsonb_build_object(
    'sdkVersion', '57.0.0',
    'name', CASE gm.chan WHEN 'production' THEN 'BBPlayer'
                         WHEN 'preview' THEN 'BBPlayer (Preview)'
                         ELSE 'BBPlayer (Dev)' END,
    'slug', 'bbplayer', 'owner', 'roitium',
    'version', CASE gm.line WHEN 'prod-legacy' THEN '2.5.4'
                WHEN 'prod-r1' THEN '2.6.0'
                WHEN 'prod-r2' THEN '2.6.2'
                WHEN 'prev-a1' THEN '2.6.5-alpha.1'
                ELSE '2.6.5-alpha.2' END,
    'projectId', '1cbd8d50-e322-4ead-98b6-4ee8b6f2a707',
    'runtimeVersion', gm.rv
  ),
  bb_seed_sha64('meta:' || gm.gkey),
  'active'
FROM t_gmeta gm;

-- ---------------------------------------------------------------------------
-- 4. updates (launch bundle metadata per group+platform)
-- ---------------------------------------------------------------------------
INSERT INTO updates (id, group_id, platform, launch_key, launch_hash, created_at)
SELECT gm.uid_a, gm.gid, 'android',
       '_expo/static/js/android/AppEntry-' || left(md5('launch:' || gm.gkey), 16) || '.hbc',
       md5('launchhash:' || gm.gkey || 'android'), gm.ts
FROM t_gmeta gm
UNION ALL
SELECT gm.uid_i, gm.gid, 'ios',
       '_expo/static/js/ios/AppEntry-' || left(md5('launch:' || gm.gkey || 'x'), 16) || '.hbc',
       md5('launchhash:' || gm.gkey || 'ios'), gm.ts
FROM t_gmeta gm;

-- ---------------------------------------------------------------------------
-- 5. assets: launch bundle + a few ordinary assets per update
-- ---------------------------------------------------------------------------
INSERT INTO assets (update_id, asset_key, object_key, sha256, content_type, size_bytes, is_launch)
SELECT uid, asset_key, 'updates/' || gkey || '/' || platform || '/' || asset_key,
       bb_seed_sha64('sha:' || gkey || platform || asset_key), content_type, size_bytes, is_launch
FROM (
  -- launch bundle per platform
  SELECT gm.uid_a AS uid, gm.gkey, 'android' AS platform,
         '_expo/static/js/android/AppEntry-' || left(md5('launch:' || gm.gkey), 16) || '.hbc' AS asset_key,
         'application/javascript' AS content_type, gm.abytes AS size_bytes, true AS is_launch
  FROM t_gmeta gm
  UNION ALL
  SELECT gm.uid_i, gm.gkey, 'ios',
         '_expo/static/js/ios/AppEntry-' || left(md5('launch:' || gm.gkey || 'x'), 16) || '.hbc',
         'application/javascript', gm.ibytes, true
  FROM t_gmeta gm
  UNION ALL
  -- ordinary assets per (group,platform): fonts/images/pages
  SELECT CASE p.platform WHEN 'android' THEN gm.uid_a ELSE gm.uid_i END, gm.gkey, p.platform, a.akey,
         a.ctype,
         CASE a.akey WHEN 'assets/images/skins/default.json' THEN bb_seed_int('a1:' || gm.gkey || p, 8, 60)
                     WHEN 'assets/fonts/NotoSansSC-Regular.otf' THEN bb_seed_int('a2:' || gm.gkey || p, 3800000, 5200000)
                     WHEN 'assets/fonts/NotoSansSC-Medium.otf' THEN bb_seed_int('a3:' || gm.gkey || p, 3800000, 5200000)
                     WHEN 'assets/splash/waveform.png' THEN bb_seed_int('a4:' || gm.gkey || p, 90000, 260000)
                     ELSE bb_seed_int('a5:' || gm.gkey || p, 3000, 40000) END,
         false
  FROM t_gmeta gm
  CROSS JOIN (VALUES
    ('android'), ('ios')
  ) p(platform)
  CROSS JOIN (VALUES
    ('assets/images/skins/default.json','application/json'),
    ('assets/fonts/NotoSansSC-Regular.otf','font/otf'),
    ('assets/fonts/NotoSansSC-Medium.otf','font/otf'),
    ('assets/splash/waveform.png','image/png'),
    ('assets/images/empty-state.png','image/png')
  ) a(akey, ctype)
) x;

-- ---------------------------------------------------------------------------
-- 6. channel_heads (final state per channel+rv+platform)
--    prod-legacy -> gL0 | prod-r1 -> gP2 | prod-r2 -> gP5 | prev-a1 -> gV1 (rollback)
--    prev-a2 -> gW2 | dev -> gD2
-- ---------------------------------------------------------------------------
INSERT INTO channel_heads (channel, runtime_version, platform, group_id, mode, updated_at)
SELECT gm.chan, gm.rv, p.platform, gm.gid, 'ota',
       bb_seed_day(CASE WHEN gm.gkey = 'gV1' THEN 6 ELSE gm.kpub END) +
         make_interval(mins => bb_seed_int('headmin:' || gm.gkey || p.platform, 600, 1080))
FROM (VALUES ('gL0'), ('gP2'), ('gP5'), ('gV1'), ('gW2'), ('gD2')) h(gkey)
JOIN t_gmeta gm USING (gkey)
CROSS JOIN (VALUES ('android'), ('ios')) p(platform);

-- ---------------------------------------------------------------------------
-- 7. channel_history: publish per group+platform; rollback rows for prev-a1
-- ---------------------------------------------------------------------------
INSERT INTO channel_history (channel, runtime_version, platform, group_id, mode, action, actor, created_at)
SELECT gm.chan, gm.rv, p.platform, gm.gid, 'ota', 'publish', 'admin', gm.ts
FROM t_gmeta gm
CROSS JOIN (VALUES ('android'), ('ios')) p(platform)
UNION ALL
SELECT 'preview', rv, p.platform, gid, 'ota', 'rollback', 'admin',
       bb_seed_day(6) + make_interval(mins => bb_seed_int('rollmin:' || p.platform, 1140, 1260))
FROM (VALUES ('gV1')) h(gkey)
JOIN t_gmeta gm USING (gkey)
CROSS JOIN (VALUES ('android'), ('ios')) p(platform);

-- ---------------------------------------------------------------------------
-- 8. patches: transitions between consecutive groups per line (per platform)
--    gV1->gV2 ios failed (patch never built cleanly, crash story) / gP1->gP2 ios failed
--    gP4->gP5 android not_beneficial
-- ---------------------------------------------------------------------------
INSERT INTO patches
  (from_update_id, to_update_id, platform, status, object_key, sha256, size_bytes,
   attempts, served_count, error, created_at, updated_at)
SELECT
  bb_seed_uuid('upd:' || p.from_g || ':' || p.platform),
  bb_seed_uuid('upd:' || p.to_g || ':' || p.platform),
  p.platform, p.status,
  'patches/' || p.from_g || '/' || p.platform || '/' || p.to_g || '.patch',
  bb_seed_sha64('patch:' || p.from_g || p.to_g || p.platform),
  round((bb_seed_frac('pct:' || p.from_g || p.to_g || p.platform) * 0.08 + 0.06) *
        CASE p.platform WHEN 'android' THEN t2.abytes ELSE t2.ibytes END)::int,
  0, 0, p.error,
  t2.ts, t2.ts
FROM (VALUES
  ('gP1','gP2','android','ready',NULL), ('gP1','gP2','ios','failed','bsdiff: unexpected end of input stream'),
  ('gP3','gP4','android','ready',NULL), ('gP3','gP4','ios','ready',NULL),
  ('gP4','gP5','android','not_beneficial',NULL), ('gP4','gP5','ios','ready',NULL),
  ('gV1','gV2','android','ready',NULL), ('gV1','gV2','ios','failed','bsdiff: input file too large'),
  ('gW1','gW2','android','ready',NULL), ('gW1','gW2','ios','ready',NULL),
  ('gD0','gD1','android','ready',NULL), ('gD0','gD1','ios','ready',NULL),
  ('gD1','gD2','android','ready',NULL), ('gD1','gD2','ios','ready',NULL)
) p(from_g, to_g, platform, status, error)
JOIN t_gmeta t2 ON t2.gkey = p.to_g;

-- ---------------------------------------------------------------------------
-- 9. source_commits (ordinal 0 = head of the published group)
-- ---------------------------------------------------------------------------
INSERT INTO source_commits
  (update_group_id, ordinal, commit_sha, parent_sha, subject, author_name, authored_at)
SELECT gm.gid, c.ordinal,
       bb_seed_sha40('sha:' || gm.gkey || ':' || c.ordinal),
       CASE WHEN c.ordinal > 0 THEN bb_seed_sha40('sha:' || gm.gkey || ':' || (c.ordinal - 1)) ELSE NULL END,
       c.subject, 'roitium',
       gm.ts - make_interval(hours => (c.ordinal + 1) * bb_seed_int('authh:' || gm.gkey || c.ordinal, 3, 30))
FROM t_gmeta gm
JOIN (VALUES
  ('gL0', 0, 'hot-update'), ('gL0', 1, 'mobile: bump version to 2.5.4'), ('gL0', 2, 'mobile: fix playlist drag reorder'),
  ('gP1', 0, 'mobile/player/headlessTask: when app in background, lyrics never update bug'),
  ('gP1', 1, 'hot-update'),
  ('gP2', 0, 'mobile: bump version'),
  ('gP3', 0, 'mobile: support wavy seek slider on android'),
  ('gP3', 1, 'hot-update'),
  ('gP4', 0, 'mobile/skin/appbar: use bilibili skin api text color as AppBar title color'),
  ('gP5', 0, 'mobile/backup/webdav: decouple fetch/mutate codes to react-query'),
  ('gV1', 0, 'mobile/playerQueue: change sheet implementation groundwork'),
  ('gV1', 1, 'hot-update'),
  ('gV2', 0, 'mobile/playerQueue: change sheet implementation to @swmansion/react-native-bottom-sheet'),
  ('gW1', 0, 'mobile/playerQueue: fix bottom-sheet crash after gV2 regression'),
  ('gW1', 1, 'hot-update'),
  ('gW2', 0, 'mobile: remove danmaku remnants'),
  ('gD0', 0, 'mobile: dev channel debug session'),
  ('gD1', 0, 'dev: log update lifecycle transitions'),
  ('gD2', 0, 'dev: sync with alpha.2 line')
) c(gkey, ordinal, subject) ON gm.gkey = c.gkey;

-- ---------------------------------------------------------------------------
-- 10. installation pool: 6 native fleets
--   fkey line             ver             build  android%  n   (n x daily activity)
--   L    prod-legacy      2.5.4           1040   0.78      58
--   P1   prod-r1          2.6.0           1095   0.78     150
--   P2   prod-r2          2.6.2           1102   0.80     215
--   V1   prev-a1          2.6.5-alpha.1   1105   0.62      64
--   V2   prev-a2          2.6.5-alpha.2   1113   0.62      58
--   DV   dev              2.6.5-alpha.2   1113   0.70      30
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE t_inst (
  fkey text NOT NULL, i int NOT NULL, platform text NOT NULL, hmac text NOT NULL,
  chan text NOT NULL, rv text NOT NULL, cver text NOT NULL, cbuild text NOT NULL,
  PRIMARY KEY (fkey, i)
);

INSERT INTO t_inst (fkey, i, platform, hmac, chan, rv, cver, cbuild)
SELECT f.fkey, s AS i,
       CASE WHEN bb_seed_frac('plat:' || f.fkey || s) < f.ashare THEN 'android' ELSE 'ios' END,
       bb_seed_hmac(f.fkey || ':' || s),
       f.chan, md5('rv:' || f.line), f.cver, f.cbuild
FROM (VALUES
  ('L',  'production', 'prod-legacy', 58, 0.78,  '2.5.4',         '1040'),
  ('P1', 'production', 'prod-r1',    150, 0.78,  '2.6.0',         '1095'),
  ('P2', 'production', 'prod-r2',    215, 0.80,  '2.6.2',         '1102'),
  ('V1', 'preview',    'prev-a1',     64, 0.62,  '2.6.5-alpha.1', '1105'),
  ('V2', 'preview',    'prev-a2',     58, 0.62,  '2.6.5-alpha.2', '1113'),
  ('DV', 'development','dev',         30, 0.70,  '2.6.5-alpha.2', '1113')
) f(fkey, chan, line, n, ashare, cver, cbuild)
CROSS JOIN LATERAL generate_series(0, f.n - 1) s;

-- ---------------------------------------------------------------------------
-- 11. daily activity probability per fleet (k = days ago; today k=0)
--   L:  .58 until k15, then .58 -> .20 toward today (line aging out)
--   P1: born k26, .10 -> .90 across k26..k14, then .90 -> .34 today
--   P2: born k12, .15 -> .90 across k12..k4, then .90 -> .95 today
--   V1: born k14, .20 -> .90 across k14..k8, then .90 -> .40 today (alpha1 -> alpha2 move)
--   V2: born k5,  .25 -> .92 across k5..k0
--   DV: born k12, .20 -> .85 across k12..k5, then flat .85
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bb_seed_p(fkey text, k int) RETURNS numeric AS $$
  SELECT CASE fkey
    WHEN 'L'  THEN CASE WHEN k >= 15 THEN 0.58 ELSE 0.58 - 0.38 * (15 - k) / 15.0 END
    WHEN 'P1' THEN CASE WHEN k > 26 THEN 0
                        WHEN k >= 14 THEN 0.10 + 0.80 * (26 - k) / 12.0
                        ELSE 0.90 - 0.56 * (14 - k) / 14.0 END
    WHEN 'P2' THEN CASE WHEN k > 12 THEN 0
                        WHEN k >= 4 THEN 0.15 + 0.75 * (12 - k) / 8.0
                        ELSE 0.90 + 0.05 * (4 - k) / 4.0 END
    WHEN 'V1' THEN CASE WHEN k > 14 THEN 0
                        WHEN k >= 8 THEN 0.20 + 0.70 * (14 - k) / 6.0
                        ELSE 0.90 - 0.50 * (8 - k) / 8.0 END
    WHEN 'V2' THEN CASE WHEN k > 5 THEN 0
                        ELSE 0.25 + 0.67 * (5 - k) / 5.0 END
    WHEN 'DV' THEN CASE WHEN k > 12 THEN 0
                        WHEN k >= 5 THEN 0.20 + 0.65 * (12 - k) / 7.0
                        ELSE 0.85 END
    ELSE 0 END;
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- 12. adoption chain: every install adopts every group on its line,
--     (1 + i%2) days after the group is published. prev-a1 additionally
--     re-adopts gV1 after the rollback (k6 -> readopt k5/k4).
--     L has one pre-window adoption (k40) so its devices run gL0 all window.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE t_adopt (
  fkey text NOT NULL, i int NOT NULL, platform text NOT NULL, gkey text NOT NULL,
  k int NOT NULL, uid uuid NOT NULL, gid uuid NOT NULL
);

INSERT INTO t_adopt (fkey, i, platform, gkey, k, uid, gid)
SELECT t.fkey, t.i, t.platform, c.gkey,
       c.kbase - 1 - (t.i % 2),
       CASE t.platform WHEN 'android' THEN gm.uid_a ELSE gm.uid_i END, gm.gid
FROM (VALUES
  ('L',  'gL0', 40),
  ('P1', 'gP1', 26), ('P1', 'gP2', 19),
  ('P2', 'gP3', 12), ('P2', 'gP4', 8), ('P2', 'gP5', 3),
  ('V1', 'gV1', 14), ('V1', 'gV2', 8), ('V1', 'gV1', 6),
  ('V2', 'gW1', 5),  ('V2', 'gW2', 2),
  ('DV', 'gD0', 12), ('DV', 'gD1', 7), ('DV', 'gD2', 2)
) c(fkey, gkey, kbase)
JOIN t_inst t USING (fkey)
JOIN t_gmeta gm ON gm.gkey = c.gkey;

-- ---------------------------------------------------------------------------
-- 13. daily actives with their running update that day
--     (running = latest adoption with k <= day; inactive installs drop out)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE t_act AS
SELECT t.fkey, t.i, t.platform, t.hmac, t.chan, t.rv, t.cver, t.cbuild, tk.k,
       a.uid AS run_uid, a.gid AS run_gid, a.gkey AS run_gkey
FROM t_inst t
JOIN generate_series(0, 29) tk(k) ON bb_seed_frac('act:' || t.fkey || t.i || tk.k) < bb_seed_p(t.fkey, tk.k)
JOIN LATERAL (
  SELECT a.uid, a.gid, a.gkey
  FROM t_adopt a
  WHERE a.fkey = t.fkey AND a.i = t.i AND a.platform = t.platform AND a.k <= tk.k
  ORDER BY a.k DESC
  LIMIT 1
) a ON true;

CREATE INDEX ON t_act (fkey, i, k);

-- ---------------------------------------------------------------------------
-- 14. update_events
--     per active install-day slots: activity always; update checks; launch
--     success/failure; rare error_recovery / emergency_launch.
--     adoption days additionally: download_*, launch_* with crash story on gV2.
-- ---------------------------------------------------------------------------
-- 14a. activity + update checks + launch lifecycle from slots
INSERT INTO update_events
  (id, schema_version, event_type, occurred_at, installation_hmac, client_version,
   client_build_version, expo_updates_version, updates_protocol_version, platform,
   runtime_version, channel, update_id, embedded_update_id, group_id, launch_source, payload)
SELECT
  gen_random_uuid(), 1, e.event_type,
  bb_seed_day(t.k) + make_interval(mins => bb_seed_int('ev:' || e.event_type || t.fkey || t.i || t.k, 330, 1410)),
  t.hmac, t.cver, t.cbuild, '57', '1', t.platform, t.rv, t.chan,
  CASE WHEN e.event_type = 'emergency_launch' THEN NULL ELSE t.run_uid END,
  NULL,
  CASE WHEN e.event_type = 'emergency_launch' THEN NULL ELSE t.run_gid END,
  CASE WHEN e.event_type IN ('launch_started','launch_succeeded','launch_failed') THEN 'ota'
       WHEN e.event_type = 'emergency_launch' THEN 'emergency' ELSE NULL END,
  CASE WHEN e.event_type = 'emergency_launch'
       THEN jsonb_build_object('emergency_launch_reason', 'update failed repeatedly')
       ELSE '{}'::jsonb END
FROM t_act t
CROSS JOIN (VALUES
  ('activity', 0.0, 1.0, ''),
  ('update_check_no_update', 0.0, 0.84, ''),
  ('update_check_found_update', 0.84, 0.90, ''),
  ('launch_started', 0.0, 0.50, ''),
  ('launch_succeeded', 0.0, 0.465, ''),
  ('launch_failed', 0.465, 0.469, ''),
  ('error_recovery', 0.9992, 1.0, ''),
  ('emergency_launch', 0.999, 0.9992, '')
) e(event_type, p0, p1, ignored)
WHERE bb_seed_frac('slot:' || t.fkey || t.i || t.k || ':' || e.event_type) >= e.p0
  AND bb_seed_frac('slot:' || t.fkey || t.i || t.k || ':' || e.event_type) < e.p1;

-- 14b. adoption events (download + launch), crash story on prev-a1 gV2
--      crash cohort: every 7th install of fleet V1 adopting gV2 (~15% of 64)
INSERT INTO update_events
  (id, schema_version, event_type, occurred_at, installation_hmac, client_version,
   client_build_version, expo_updates_version, updates_protocol_version, platform,
   runtime_version, channel, update_id, embedded_update_id, group_id, launch_source, payload)
SELECT
  gen_random_uuid(), 1, e.event_type,
  bb_seed_day(a.k) + make_interval(mins => bb_seed_int('dl:' || a.fkey || a.i || a.gkey, 330, 1050)),
  t.hmac, t.cver, t.cbuild, '57', '1', t.platform, t.rv, t.chan,
  a.uid, NULL::uuid, a.gid,
  'ota',
  '{}'::jsonb
FROM t_adopt a
JOIN t_inst t USING (fkey, i, platform)
CROSS JOIN LATERAL (
  SELECT unnest(CASE
    WHEN a.fkey = 'V1' AND a.gkey = 'gV2' AND a.i % 7 = 0 THEN
      ARRAY['download_started'::text, 'download_succeeded', 'launch_started', 'launch_failed']
    WHEN bb_seed_frac('dlf:' || a.fkey || a.i || a.gkey) < 0.06 THEN
      ARRAY['download_started'::text, 'download_failed', 'launch_started', 'launch_failed']
    ELSE
      ARRAY['download_started'::text, 'download_succeeded', 'launch_started', 'launch_succeeded']
  END) AS event_type
) e
WHERE a.k BETWEEN 0 AND 29
UNION ALL
-- crash cohort follow-ups: emergency launch (same day) / error recovery (2 days later)
SELECT
  gen_random_uuid(), 1, e2.event_type,
  bb_seed_day(a.k + CASE WHEN e2.event_type = 'error_recovery' THEN 2 ELSE 0 END)
    + make_interval(mins => bb_seed_int('crash:' || a.fkey || a.i, 300, 900)),
  t.hmac, t.cver, t.cbuild, '57', '1', t.platform, t.rv, t.chan,
  CASE WHEN e2.event_type = 'emergency_launch' THEN NULL ELSE a.uid END,
  NULL::uuid,
  CASE WHEN e2.event_type = 'emergency_launch' THEN NULL ELSE a.gid END,
  CASE WHEN e2.event_type = 'emergency_launch' THEN 'emergency' ELSE NULL END,
  CASE WHEN e2.event_type = 'emergency_launch'
       THEN jsonb_build_object('emergency_launch_reason', 'update failed repeatedly')
       ELSE '{}'::jsonb END
FROM t_adopt a
JOIN t_inst t USING (fkey, i, platform)
JOIN LATERAL (
  SELECT 'emergency_launch' AS event_type WHERE a.i % 2 = 0
  UNION ALL
  SELECT 'error_recovery' WHERE a.i % 4 = 1
) e2 ON true
WHERE a.fkey = 'V1' AND a.gkey = 'gV2' AND a.i % 7 = 0 AND a.k BETWEEN 0 AND 29
  AND (a.k + CASE WHEN e2.event_type = 'error_recovery' THEN 2 ELSE 0 END) <= 29;

-- ---------------------------------------------------------------------------
-- 15. materialized client insights, matching the API's write-side behavior
-- ---------------------------------------------------------------------------
INSERT INTO installation_activity_days
  (day, installation_hmac, channel, runtime_version, platform, client_version,
   client_build_version, update_id, group_id, first_seen_at, last_seen_at)
SELECT occurred_at::date, installation_hmac, channel, runtime_version, platform,
       client_version, client_build_version, update_id, group_id,
       min(occurred_at), max(occurred_at)
FROM update_events
WHERE update_id IS NOT NULL
GROUP BY occurred_at::date, installation_hmac, channel, runtime_version, platform,
         client_version, client_build_version, update_id, group_id;

INSERT INTO known_update_launches
  (installation_hmac, update_id, group_id, channel, runtime_version, platform, confirmed_at)
SELECT DISTINCT ON (installation_hmac, update_id)
       installation_hmac, update_id, group_id, channel, runtime_version, platform, occurred_at
FROM update_events
WHERE event_type = 'launch_succeeded' AND update_id IS NOT NULL
ORDER BY installation_hmac, update_id, occurred_at;

INSERT INTO known_update_crashes
  (installation_hmac, update_id, group_id, channel, runtime_version, platform, confirmed_at)
SELECT DISTINCT ON (installation_hmac, update_id)
       installation_hmac, update_id, group_id, channel, runtime_version, platform, occurred_at
FROM update_events
WHERE event_type = 'launch_failed' AND update_id IS NOT NULL
ORDER BY installation_hmac, update_id, occurred_at;

-- ---------------------------------------------------------------------------
-- 16. daily aggregates and transport/server metrics for dashboard charts
-- ---------------------------------------------------------------------------
INSERT INTO daily_update_metrics
  (day, channel, runtime_version, platform, group_id, event_type, event_count, unique_installations)
SELECT occurred_at::date, channel, runtime_version, platform,
       COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid),
       event_type, count(*), count(DISTINCT installation_hmac)
FROM update_events
GROUP BY occurred_at::date, channel, runtime_version, platform,
         COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), event_type;

INSERT INTO service_metric_minutes (minute, route, status, request_count, duration_ms)
SELECT bb_seed_day(k) + make_interval(hours => h), route, status,
       bb_seed_int('svc:n:' || k || ':' || h || ':' || route || ':' || status, 35, 220),
       bb_seed_int('svc:d:' || k || ':' || h || ':' || route || ':' || status, 2500, 28000)
FROM generate_series(0, 29) k
CROSS JOIN (VALUES (9), (12), (18), (21)) hours(h)
CROSS JOIN (VALUES ('/api/manifest'), ('/api/events'), ('/admin/insights')) routes(route)
CROSS JOIN (VALUES (200), (500)) statuses(status);

INSERT INTO delivery_metric_minutes
  (minute, channel, runtime_version, platform, group_id, kind, outcome,
   request_count, byte_count, target_byte_count)
SELECT bb_seed_day(a.k) + make_interval(hours => 10), a.chan, a.rv, a.platform, a.run_gid,
       'launch_bundle', 'served', count(*), sum(asset.size_bytes), sum(asset.size_bytes)
FROM t_act a
JOIN updates u ON u.id = a.run_uid
JOIN assets asset ON asset.update_id = u.id AND asset.is_launch
GROUP BY a.k, a.chan, a.rv, a.platform, a.run_gid
UNION ALL
SELECT bb_seed_day(a.k) + make_interval(hours => 14), a.chan, a.rv, a.platform, a.run_gid,
       'patch', 'served', count(*), sum(round(asset.size_bytes * 0.11)::bigint), sum(asset.size_bytes)
FROM t_act a
JOIN updates u ON u.id = a.run_uid
JOIN assets asset ON asset.update_id = u.id AND asset.is_launch
WHERE bb_seed_frac('patch:' || a.fkey || a.i || a.k) < 0.42
GROUP BY a.k, a.chan, a.rv, a.platform, a.run_gid
UNION ALL
SELECT bb_seed_day(a.k) + make_interval(hours => 14), a.chan, a.rv, a.platform, a.run_gid,
       'patch_fallback', 'served', count(*), sum(asset.size_bytes), sum(asset.size_bytes)
FROM t_act a
JOIN updates u ON u.id = a.run_uid
JOIN assets asset ON asset.update_id = u.id AND asset.is_launch
WHERE bb_seed_frac('fallback:' || a.fkey || a.i || a.k) < 0.06
GROUP BY a.k, a.chan, a.rv, a.platform, a.run_gid;

DROP FUNCTION bb_seed_p(text, int);
DROP FUNCTION bb_seed_hmac(text);
DROP FUNCTION bb_seed_uuid(text);
DROP FUNCTION bb_seed_sha64(text);
DROP FUNCTION bb_seed_sha40(text);
DROP FUNCTION bb_seed_day(int);
DROP FUNCTION bb_seed_int(text, int, int);
DROP FUNCTION bb_seed_frac(text);

COMMIT;
