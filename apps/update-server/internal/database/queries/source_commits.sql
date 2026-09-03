-- name: InsertSourceCommit :exec
INSERT INTO source_commits (update_group_id,ordinal,commit_sha,parent_sha,subject,author_name,authored_at) VALUES ($1,$2,$3,$4,$5,$6,$7);

-- name: ListSourceCommits :many
SELECT ordinal,commit_sha,parent_sha,subject,author_name,authored_at FROM source_commits WHERE update_group_id=$1 ORDER BY ordinal;

-- name: ListSourceCommitsForGroups :many
SELECT update_group_id,ordinal,commit_sha,parent_sha,subject,author_name,authored_at FROM source_commits WHERE update_group_id=$1 OR update_group_id=$2 ORDER BY update_group_id,ordinal;
