-- name: GetChannelHead :one
SELECT mode,group_id FROM channel_heads WHERE channel=$1 AND runtime_version=$2 AND platform=$3;

-- name: GetUpdateForGroupPlatform :one
SELECT u.id,u.launch_key,u.launch_hash,g.created_at FROM updates u JOIN update_groups g ON g.id=u.group_id WHERE u.group_id=$1 AND u.platform=$2;

-- name: ListAssetsForUpdate :many
SELECT id,asset_key,object_key,sha256,content_type,is_launch FROM assets WHERE update_id=$1 ORDER BY is_launch DESC,id;

-- name: GetAsset :one
SELECT a.object_key,a.content_type,a.size_bytes,u.group_id,u.id,a.is_launch,u.platform,g.runtime_version,g.channel FROM assets a JOIN updates u ON u.id=a.update_id JOIN update_groups g ON g.id=u.group_id WHERE a.id=$1;

-- name: InsertAsset :exec
INSERT INTO assets(update_id,asset_key,object_key,sha256,content_type,size_bytes,is_launch) VALUES($1,$2,$3,$4,$5,$6,$7);
