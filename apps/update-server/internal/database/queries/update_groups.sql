-- name: LatestSourceCommit :one
SELECT COALESCE(source->>'commit_sha', '')::text AS commit_sha FROM channel_heads h JOIN update_groups g ON g.id=h.group_id WHERE h.channel=$1 AND h.runtime_version=$2 AND h.mode='ota' ORDER BY h.updated_at DESC LIMIT 1;

-- name: ListUpdateGroups :many
SELECT id,channel,runtime_version,COALESCE(expo_config->>'version','')::text AS app_version,message,created_at,source,fingerprint_hash,republished_from_update_id FROM update_groups ORDER BY created_at DESC LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: GetUpdateGroup :one
SELECT id,channel,runtime_version,message,created_at,source,fingerprint_hash,fingerprint_sources,expo_config,metadata_sha256,status,republished_from_update_id FROM update_groups WHERE id=$1;

-- name: FindGroupsByCommit :many
SELECT id,channel,runtime_version,message,created_at FROM update_groups WHERE source->>'commit_sha'=sqlc.arg(commit_sha)::text ORDER BY created_at DESC;

-- name: FindGroupsOrSourceCommitsByCommit :many
SELECT ug.id,ug.channel,ug.runtime_version,ug.message,ug.created_at FROM update_groups ug WHERE ug.source->>'commit_sha'=$1 OR EXISTS (SELECT 1 FROM source_commits sc WHERE sc.update_group_id=ug.id AND sc.commit_sha=$1) ORDER BY ug.created_at DESC;

-- name: GetUpdateGroupSource :one
SELECT source FROM update_groups WHERE id=$1;

-- name: GetUpdateGroupArtifacts :one
SELECT metadata_sha256,expo_config FROM update_groups WHERE id=$1;

-- name: ListUpdatesForGroup :many
SELECT platform,launch_hash FROM updates WHERE group_id=$1 ORDER BY platform;
