package patchworker

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"

	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/objectstore"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/store"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const minimumSaving = 0.10

var ErrNotBeneficial = fmt.Errorf("patch has insufficient saving")

type job struct {
	id             int64
	from, to       uuid.UUID
	fromKey, toKey string
	targetSize     int64
}

// RunOnce claims at most one job. A separate process is used so bsdiff's CPU
// and memory use cannot delay manifest requests in the API process.
func RunOnce(ctx context.Context, db *store.Store, objects objectstore.Store) (bool, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	var j job
	err = tx.QueryRow(ctx, `WITH claimed AS (
 SELECT p.id,p.from_update_id,p.to_update_id,a1.object_key AS from_key,a2.object_key AS to_key,a2.size_bytes
 FROM patches p
 JOIN assets a1 ON a1.update_id=p.from_update_id AND a1.is_launch
 JOIN assets a2 ON a2.update_id=p.to_update_id AND a2.is_launch
 WHERE p.status='pending'
    OR (p.status='processing' AND p.processing_started_at < now() - interval '10 minutes')
 ORDER BY p.created_at FOR UPDATE SKIP LOCKED LIMIT 1
 ) UPDATE patches p SET status='processing',attempts=p.attempts+1,processing_started_at=now(),updated_at=now()
 FROM claimed c WHERE p.id=c.id
 RETURNING c.id,c.from_update_id,c.to_update_id,c.from_key,c.to_key,c.size_bytes`,
	).Scan(&j.id, &j.from, &j.to, &j.fromKey, &j.toKey, &j.targetSize)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, tx.Commit(ctx)
		}
		return false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return false, err
	}
	patch, err := makePatch(ctx, objects, j)
	if err != nil {
		status := "failed"
		if err == ErrNotBeneficial {
			status = "not_beneficial"
		}
		_, updateErr := db.Pool.Exec(ctx, "UPDATE patches SET status=$2,error=$3,processing_started_at=NULL,updated_at=now() WHERE id=$1", j.id, status, err.Error())
		return true, updateErr
	}
	_, err = db.Pool.Exec(ctx, "UPDATE patches SET status='ready',object_key=$2,sha256=$3,size_bytes=$4,error=NULL,processing_started_at=NULL,updated_at=now() WHERE id=$1", j.id, patch.key, patch.sha, patch.size)
	return true, err
}

type result struct {
	key, sha string
	size     int64
}

func makePatch(ctx context.Context, objects objectstore.Store, j job) (result, error) {
	fail := func(err error) (result, error) { return result{}, err }
	base, err := read(ctx, objects, j.fromKey)
	if err != nil {
		return fail(err)
	}
	target, err := read(ctx, objects, j.toKey)
	if err != nil {
		return fail(err)
	}
	dir, err := os.MkdirTemp("", "bbplayer-bsdiff-")
	if err != nil {
		return fail(err)
	}
	defer os.RemoveAll(dir)
	oldPath, newPath, patchPath, restoredPath := path.Join(dir, "old.hbc"), path.Join(dir, "new.hbc"), path.Join(dir, "patch"), path.Join(dir, "restored.hbc")
	if err = os.WriteFile(oldPath, base, 0o600); err != nil {
		return fail(err)
	}
	if err = os.WriteFile(newPath, target, 0o600); err != nil {
		return fail(err)
	}
	if out, err := exec.CommandContext(ctx, "bsdiff", "--format=bsdiff40", oldPath, newPath, patchPath).CombinedOutput(); err != nil {
		return fail(fmt.Errorf("bsdiff: %w: %s", err, out))
	}
	if out, err := exec.CommandContext(ctx, "bspatch", oldPath, restoredPath, patchPath).CombinedOutput(); err != nil {
		return fail(fmt.Errorf("bspatch: %w: %s", err, out))
	}
	restored, err := os.ReadFile(restoredPath)
	if err != nil {
		return fail(err)
	}
	if !bytes.Equal(restored, target) {
		return fail(fmt.Errorf("bspatch reconstruction hash mismatch"))
	}
	patch, err := os.ReadFile(patchPath)
	if err != nil {
		return fail(err)
	}
	if len(patch) >= int(float64(len(target))*(1-minimumSaving)) {
		return fail(ErrNotBeneficial)
	}
	if !bytes.HasPrefix(patch, []byte("BSDIFF40")) {
		return fail(fmt.Errorf("bsdiff output missing BSDIFF40 header"))
	}
	h := sha256.Sum256(patch)
	key := path.Join("patches", j.from.String(), j.to.String()+".bsdiff")
	if err := objects.Put(ctx, key, "application/octet-stream", patch); err != nil {
		return fail(err)
	}
	return result{key: key, sha: base64.RawURLEncoding.EncodeToString(h[:]), size: int64(len(patch))}, nil
}

func read(ctx context.Context, objects objectstore.Store, key string) ([]byte, error) {
	b, _, e := objects.Get(ctx, key)
	if e != nil {
		return nil, e
	}
	defer b.Close()
	return io.ReadAll(b)
}
func Hash(b []byte) string { h := sha256.Sum256(b); return base64.RawURLEncoding.EncodeToString(h[:]) }

// RollupDaily keeps raw events immutable while maintaining an inexpensive
// query table for Insights. Re-running it is idempotent for the current day.
func RollupDaily(ctx context.Context, db *store.Store) error {
	_, err := db.Pool.Exec(ctx, `INSERT INTO daily_update_metrics(day,channel,runtime_version,platform,group_id,event_type,event_count,unique_installations)
SELECT occurred_at::date,COALESCE(channel,''),COALESCE(runtime_version,''),COALESCE(platform,''),COALESCE(group_id,'00000000-0000-0000-0000-000000000000'::uuid),event_type,count(*),count(DISTINCT installation_hmac)
FROM update_events WHERE occurred_at::date >= current_date - 1 GROUP BY 1,2,3,4,5,6
ON CONFLICT(day,channel,runtime_version,platform,group_id,event_type) DO UPDATE SET event_count=excluded.event_count,unique_installations=excluded.unique_installations`)
	return err
}
