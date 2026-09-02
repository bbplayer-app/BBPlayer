package server

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	dbq "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Server) asset(w http.ResponseWriter, r *http.Request) {
	assetID := chi.URLParam(r, "assetID")
	id, parseErr := strconv.ParseInt(assetID, 10, 64)
	if parseErr != nil {
		http.NotFound(w, r)
		return
	}
	asset, e := s.DB.Queries.GetAsset(r.Context(), id)
	if e != nil {
		if !errors.Is(e, pgx.ErrNoRows) {
			s.logError(r, "asset: lookup", e, "asset_id", id)
			http.Error(w, "database", http.StatusInternalServerError)
			return
		}
		http.NotFound(w, r)
		return
	}
	if asset.IsLaunch && strings.Contains(r.Header.Get("A-IM"), "bsdiff") {
		base, parseErr := uuid.Parse(r.Header.Get("Expo-Current-Update-ID"))
		if parseErr == nil {
			patchKey, err := s.DB.Queries.GetReadyPatchObjectKey(r.Context(), dbq.GetReadyPatchObjectKeyParams{FromUpdateID: pgUUID(&base), ToUpdateID: asset.ID})
			if err == nil {
				if served, size := s.writeObjectStatus(w, r, patchKey.String, "application/octet-stream", http.StatusIMUsed, map[string]string{"IM": "bsdiff", "expo-base-update-id": base.String()}); served {
					if err := s.DB.Queries.IncrementPatchServed(r.Context(), dbq.IncrementPatchServedParams{FromUpdateID: pgUUID(&base), ToUpdateID: asset.ID}); err != nil {
						s.logError(r, "asset: increment patch served counter", err, "from", base.String(), "to", uuid.UUID(asset.ID.Bytes).String())
					}
					gid := uuid.UUID(asset.GroupID.Bytes)
					s.recordServerPayloadContext(r.Context(), "patch_served", &gid, asset.Platform, asset.RuntimeVersion, asset.Channel, map[string]any{"bytes": size, "target_bytes": asset.SizeBytes, "base_update_id": base.String()})
					return
				}
				gid := uuid.UUID(asset.GroupID.Bytes)
				s.recordServerPayloadContext(r.Context(), "patch_object_error", &gid, asset.Platform, asset.RuntimeVersion, asset.Channel, map[string]any{"base_update_id": base.String()})
				return
			}
		}
		gid := uuid.UUID(asset.GroupID.Bytes)
		s.recordServerPayloadContext(r.Context(), "patch_fallback_full", &gid, asset.Platform, asset.RuntimeVersion, asset.Channel, map[string]any{"reason": "not_ready_or_invalid_base"})
	}
	served, size := s.writeObjectStatus(w, r, asset.ObjectKey, asset.ContentType, http.StatusOK, nil)
	gid := uuid.UUID(asset.GroupID.Bytes)
	if served {
		s.recordServerPayloadContext(r.Context(), "asset_served", &gid, asset.Platform, asset.RuntimeVersion, asset.Channel, map[string]any{"bytes": size, "launch": asset.IsLaunch})
	} else {
		s.recordServerPayloadContext(r.Context(), "asset_object_error", &gid, asset.Platform, asset.RuntimeVersion, asset.Channel, map[string]any{"launch": asset.IsLaunch})
	}
}

func (s *Server) writeObjectStatus(w http.ResponseWriter, r *http.Request, object, ct string, status int, headers map[string]string) (bool, int64) {
	body, storedContentType, e := s.Objects.Get(r.Context(), object)
	if e != nil {
		s.logError(r, "asset: object store get", e, "object", object)
		http.Error(w, "asset unavailable", 502)
		return false, 0
	}
	defer body.Close()
	if storedContentType != "" {
		ct = storedContentType
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	for key, value := range headers {
		w.Header().Set(key, value)
	}
	w.WriteHeader(status)
	n, err := io.Copy(w, body)
	if err != nil {
		s.logError(r, "asset: stream to client", err, "object", object)
	}
	return true, n
}
