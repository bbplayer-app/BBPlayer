package patchworker

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"os"
	"os/exec"
	"path"
	"time"

	dbq "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/objectstore"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/store"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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
func RunOnce(ctx context.Context, log *slog.Logger, db *store.Store, objects objectstore.Store) (bool, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	var j job
	claimed, err := db.Queries.WithTx(tx).ClaimPatch(ctx)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, tx.Commit(ctx)
		}
		return false, err
	}
	j.id, j.from, j.to, j.fromKey, j.toKey, j.targetSize = claimed.ID, claimed.FromUpdateID.Bytes, claimed.ToUpdateID.Bytes, claimed.FromKey, claimed.ToKey, claimed.SizeBytes
	if err = tx.Commit(ctx); err != nil {
		return false, err
	}
	started := time.Now()
	log.Info("patch job claimed", "job_id", j.id, "from_update", j.from.String(), "to_update", j.to.String(), "from_object", j.fromKey, "to_object", j.toKey, "target_size_bytes", j.targetSize)
	patch, err := makePatch(ctx, log, objects, j)
	if err != nil {
		status := "failed"
		kv := []any{"job_id", j.id, "from_update", j.from.String(), "to_update", j.to.String(), "target_size_bytes", j.targetSize, "duration_ms", time.Since(started).Milliseconds(), "error", err}
		if errors.Is(err, ErrNotBeneficial) {
			status = "not_beneficial"
			log.Warn("patch job not beneficial", kv...)
		} else {
			log.Error("patch job failed", kv...)
		}
		return true, db.Queries.FailPatch(ctx, dbq.FailPatchParams{ID: j.id, Status: status, Error: pgtype.Text{String: err.Error(), Valid: true}})
	}
	log.Info("patch job completed", "job_id", j.id, "from_update", j.from.String(), "to_update", j.to.String(), "object_key", patch.key, "patch_size_bytes", patch.size, "saving_pct", savingPct(j.targetSize, patch.size), "duration_ms", time.Since(started).Milliseconds())
	return true, db.Queries.CompletePatch(ctx, dbq.CompletePatchParams{ID: j.id, ObjectKey: pgtype.Text{String: patch.key, Valid: true}, Sha256: pgtype.Text{String: patch.sha, Valid: true}, SizeBytes: pgtype.Int8{Int64: patch.size, Valid: true}})
}

func savingPct(target, patch int64) float64 {
	return math.Round((1-float64(patch)/float64(target))*1000) / 10
}

type result struct {
	key, sha string
	size     int64
}

func makePatch(ctx context.Context, log *slog.Logger, objects objectstore.Store, j job) (result, error) {
	fail := func(err error) (result, error) { return result{}, err }
	base, err := read(ctx, objects, j.fromKey)
	if err != nil {
		return fail(fmt.Errorf("read %s: %w", j.fromKey, err))
	}
	log.Debug("patch: downloaded base bundle", "job_id", j.id, "object", j.fromKey, "size_bytes", len(base))
	target, err := read(ctx, objects, j.toKey)
	if err != nil {
		return fail(fmt.Errorf("read %s: %w", j.toKey, err))
	}
	log.Debug("patch: downloaded target bundle", "job_id", j.id, "object", j.toKey, "size_bytes", len(target))
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
	bsdiffStarted := time.Now()
	if out, err := exec.CommandContext(ctx, "bsdiff", "--format=bsdiff40", oldPath, newPath, patchPath).CombinedOutput(); err != nil {
		return fail(fmt.Errorf("bsdiff: %w: %s", err, out))
	}
	bsdiffElapsed := time.Since(bsdiffStarted)
	if out, err := exec.CommandContext(ctx, "bspatch", oldPath, restoredPath, patchPath).CombinedOutput(); err != nil {
		return fail(fmt.Errorf("bspatch: %w: %s", err, out))
	}
	log.Debug("patch: bsdiff and bspatch done", "job_id", j.id, "bsdiff_duration_ms", bsdiffElapsed.Milliseconds())
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
		return fail(fmt.Errorf("upload %s: %w", key, err))
	}
	log.Debug("patch: uploaded", "job_id", j.id, "object_key", key, "size_bytes", len(patch))
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
