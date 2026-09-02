package server

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"time"

	dbq "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// expo-updates attaches these headers to every remote manifest request (native
// startup check included, i.e. they work even when JS never ran):
//   - Expo-Current-Update-ID: the update the device is currently running; each
//     request is launch evidence for that update (embedded launches excluded,
//     mirroring EAS Update's "known launches").
//   - Expo-Embedded-Update-ID: the update baked into the native build.
//   - Expo-Recent-Failed-Update-IDs: updates the device marked failed
//     (failed_launch_count > 0) because a fatal JS error happened before first
//     render on an update that had never succeeded there; reported on the
//     request after the crash — mirroring EAS Update's "known crashes".
const (
	expoCurrentUpdateIDHeader     = "Expo-Current-Update-ID"
	expoEmbeddedUpdateIDHeader    = "Expo-Embedded-Update-ID"
	expoRecentFailedUpdatesHeader = "Expo-Recent-Failed-Update-IDs"
	bbplayerInstallationIDHeader  = "x-bbplayer-installation-id"
	bbplayerUnsetInstallationID   = "bbplayer-unset"
)

// recordUpdateRequestInsights turns a manifest request into per-installation
// known-launch / known-crash rows. It is best-effort: it never fails the
// request, and it runs before the response is decided so that 204 / rollback
// responses still count as observations.
func (s *Server) recordUpdateRequestInsights(r *http.Request, platform, runtime, channel string) {
	installation := strings.TrimSpace(r.Header.Get(bbplayerInstallationIDHeader))
	if installation == "" || installation == bbplayerUnsetInstallationID {
		// The key is predeclared in app.config.ts with this placeholder because
		// expo-updates' setUpdateRequestHeadersOverride can only override
		// predeclared keys. Requests still carrying it (fresh install's first
		// session, devices that never ran JS once, old native builds) cannot be
		// attributed to an installation, so we skip them — conservative, like
		// EAS's "only counts launches we can confirm".
		return
	}

	ctx := r.Context()
	hmacID := installationHMAC(s.C.InstallationHMACKey, installation)
	now := time.Now().UTC()

	embedded := parseUUID(r.Header.Get(expoEmbeddedUpdateIDHeader))
	if current := parseUUID(r.Header.Get(expoCurrentUpdateIDHeader)); current != nil && (embedded == nil || *current != *embedded) {
		// Embedded launches never reach the dashboard anyway; only record OTA
		// update ids.
		s.recordManifestInsight(ctx, r, hmacID, channel, runtime, platform, current, false, now)
	}
	for _, failed := range parseUUIDList(r.Header.Get(expoRecentFailedUpdatesHeader)) {
		s.recordManifestInsight(ctx, r, hmacID, channel, runtime, platform, failed, true, now)
	}
}

// recordManifestInsight resolves the update's group (unknown ids — embedded,
// foreign, or stale — are dropped) and upserts the launch or crash row. The
// known_* tables deduplicate on (installation, update), so an update that stays
// in the device's failed list across many later checks still counts once.
func (s *Server) recordManifestInsight(ctx context.Context, r *http.Request, installation, channel, runtime, platform string, updateID *uuid.UUID, crash bool, confirmedAt time.Time) {
	groupID, err := s.DB.Queries.GetGroupIDForUpdate(ctx, pgUUID(updateID))
	if errors.Is(err, pgx.ErrNoRows) {
		return
	}
	if err != nil {
		s.Log.Error("manifest insights: resolve update group", "error", err, "method", r.Method, "path", r.URL.Path, "update_id", updateID.String())
		return
	}
	params := dbq.RecordKnownLaunchParams{
		InstallationHmac: installation,
		UpdateID:         pgUUID(updateID),
		GroupID:          groupID,
		Channel:          channel,
		RuntimeVersion:   runtime,
		Platform:         platform,
		ConfirmedAt:      pgtype.Timestamptz{Time: confirmedAt, Valid: true},
	}
	if crash {
		err = s.DB.Queries.RecordKnownCrash(ctx, dbq.RecordKnownCrashParams(params))
	} else {
		err = s.DB.Queries.RecordKnownLaunch(ctx, params)
	}
	if err != nil {
		s.Log.Error("manifest insights: record known launch or crash", "error", err, "method", r.Method, "path", r.URL.Path, "update_id", updateID.String(), "crash", crash)
	}
}

// installationHMAC hashes the client-supplied installation id with the server's
// key so raw device ids never touch the database. Shared with the /api/events
// ingestion path so both pipelines identify the same installation.
func installationHMAC(key, id string) string {
	m := hmac.New(sha256.New, []byte(key))
	_, _ = m.Write([]byte(id))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

// parseUUID parses a bare uuid header value; nil when absent or malformed.
func parseUUID(value string) *uuid.UUID {
	id, err := uuid.Parse(strings.TrimSpace(value))
	if err != nil {
		return nil
	}
	return &id
}

// parseUUIDList parses the structured-header list expo-updates emits for
// Expo-Recent-Failed-Update-IDs ("<uuid>", "<uuid>", …). Elements are
// double-quoted; unparseable entries are skipped rather than failing the whole
// request.
func parseUUIDList(value string) []*uuid.UUID {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	var ids []*uuid.UUID
	for item := range strings.SplitSeq(value, ",") {
		item = strings.Trim(strings.TrimSpace(item), `"`)
		if id, err := uuid.Parse(item); err == nil {
			ids = append(ids, &id)
		}
	}
	return ids
}
