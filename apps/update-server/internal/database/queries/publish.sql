-- name: InsertUpdateGroup :exec
INSERT INTO update_groups(id,channel,runtime_version,message,source,fingerprint_hash,fingerprint_sources,expo_config,metadata_sha256,republished_from_update_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);

-- name: InsertUpdate :exec
INSERT INTO updates(id,group_id,platform,launch_key,launch_hash) VALUES($1,$2,$3,$4,$5);

-- name: InsertPendingPatch :exec
INSERT INTO patches(from_update_id,to_update_id,platform,status) VALUES($1,$2,$3,'pending') ON CONFLICT(from_update_id,to_update_id) DO NOTHING;
