-- name: LatestSourceCommit :one
SELECT COALESCE(source->>'commit_sha', '')::text AS commit_sha
FROM channel_heads h
JOIN update_groups g ON g.id = h.group_id
WHERE h.channel = $1 AND h.runtime_version = $2 AND h.mode = 'ota'
ORDER BY h.updated_at DESC
LIMIT 1;

-- name: ListUpdateGroups :many
SELECT id, channel, runtime_version, message, created_at, source
FROM update_groups
ORDER BY created_at DESC
LIMIT $1;

-- name: GetUpdateGroup :one
SELECT id, channel, runtime_version, message, created_at, source, expo_config, metadata_sha256, status
FROM update_groups
WHERE id = $1;

-- name: FindGroupsByCommit :many
SELECT id, channel, runtime_version, message, created_at
FROM update_groups
WHERE source->>'commit_sha' = sqlc.arg(commit_sha)::text
ORDER BY created_at DESC;

-- name: InsertSourceCommit :exec
INSERT INTO source_commits (update_group_id, ordinal, commit_sha, parent_sha, subject, author_name, authored_at)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: ListSourceCommits :many
SELECT ordinal, commit_sha, parent_sha, subject, author_name, authored_at
FROM source_commits
WHERE update_group_id = $1
ORDER BY ordinal;
