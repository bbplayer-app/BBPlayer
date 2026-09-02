-- name: ClaimPatch :one
WITH claimed AS (SELECT p.id,p.from_update_id,p.to_update_id,a1.object_key AS from_key,a2.object_key AS to_key,a2.size_bytes FROM patches p JOIN assets a1 ON a1.update_id=p.from_update_id AND a1.is_launch JOIN assets a2 ON a2.update_id=p.to_update_id AND a2.is_launch WHERE p.status='pending' OR (p.status='processing' AND p.processing_started_at < now()-interval '10 minutes') ORDER BY p.created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE patches p SET status='processing',attempts=p.attempts+1,processing_started_at=now(),updated_at=now() FROM claimed c WHERE p.id=c.id RETURNING c.id,c.from_update_id,c.to_update_id,c.from_key,c.to_key,c.size_bytes;

-- name: FailPatch :exec
UPDATE patches SET status=$2,error=$3,processing_started_at=NULL,updated_at=now() WHERE id=$1;

-- name: CompletePatch :exec
UPDATE patches SET status='ready',object_key=$2,sha256=$3,size_bytes=$4,error=NULL,processing_started_at=NULL,updated_at=now() WHERE id=$1;

-- name: IncrementPatchServed :exec
UPDATE patches SET served_count=served_count+1 WHERE from_update_id=$1 AND to_update_id=$2;

-- name: GetReadyPatchObjectKey :one
SELECT object_key FROM patches WHERE from_update_id=$1 AND to_update_id=$2 AND status='ready';
