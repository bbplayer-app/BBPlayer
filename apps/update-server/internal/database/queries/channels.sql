-- name: GetPreviousChannelUpdate :one
SELECT u.id FROM channel_heads h JOIN updates u ON u.group_id=h.group_id AND u.platform=h.platform WHERE h.channel=$1 AND h.runtime_version=$2 AND h.platform=$3 AND h.mode='ota';

-- name: UpsertChannelHead :exec
INSERT INTO channel_heads(channel,runtime_version,platform,group_id,mode) VALUES($1,$2,$3,$4,$5) ON CONFLICT(channel,runtime_version,platform) DO UPDATE SET group_id=excluded.group_id,mode=excluded.mode,updated_at=now();

-- name: InsertChannelHistory :exec
INSERT INTO channel_history(channel,runtime_version,platform,group_id,mode,action,actor) VALUES($1,$2,$3,$4,$5,$6,$7);

-- name: ListChannelHeads :many
SELECT channel,runtime_version,platform,group_id,mode,updated_at FROM channel_heads ORDER BY channel,runtime_version,platform;

-- name: ListChannelHeadsByChannel :many
SELECT runtime_version,platform,group_id,mode,updated_at FROM channel_heads WHERE channel=$1 ORDER BY runtime_version,platform;

-- name: ListChannelHistory :many
SELECT group_id,mode,action,created_at FROM channel_history WHERE channel=$1 ORDER BY created_at DESC;

-- name: IsCompatibleUpdateGroup :one
SELECT EXISTS(SELECT 1 FROM updates u JOIN update_groups ug ON ug.id=u.group_id WHERE ug.id=$1 AND ug.channel=$2 AND ug.runtime_version=$3 AND u.platform=$4);
