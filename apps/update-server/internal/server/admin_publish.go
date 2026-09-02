package server

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"strings"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type publishRequest struct {
	Channel        string          `json:"channel"`
	RuntimeVersion string          `json:"runtime_version"`
	Message        string          `json:"message"`
	Source         json.RawMessage `json:"source"`
	Fingerprint    struct {
		Hash    string          `json:"hash"`
		Sources json.RawMessage `json:"sources"`
	} `json:"fingerprint"`
}
type publishSource struct {
	CommitSHA        string `json:"commit_sha"`
	WorkingTreeClean bool   `json:"working_tree_clean"`
}
type exportMeta struct {
	FileMetadata map[string]struct {
		Bundle string `json:"bundle"`
		Assets []struct {
			Path string `json:"path"`
			Ext  string `json:"ext"`
		} `json:"assets"`
	} `json:"fileMetadata"`
}

func sha(b []byte) string { h := sha256.Sum256(b); return base64.RawURLEncoding.EncodeToString(h[:]) }
func (s *Server) publish(w http.ResponseWriter, r *http.Request) {
	if e := r.ParseMultipartForm(1 << 30); e != nil {
		http.Error(w, "multipart archive required", 400)
		return
	}
	var req publishRequest
	if json.Unmarshal([]byte(r.FormValue("request")), &req) != nil || req.Channel == "" || req.RuntimeVersion == "" || req.Message == "" || len(req.Source) == 0 {
		http.Error(w, "invalid publish request", 400)
		return
	}
	var source publishSource
	if json.Unmarshal(req.Source, &source) != nil || source.CommitSHA == "" {
		http.Error(w, "invalid source or fingerprint", 400)
		return
	}
	var fingerprintHash string
	var fingerprintSources []byte
	hasFingerprint := false
	if req.Fingerprint.Hash != "" || len(req.Fingerprint.Sources) != 0 {
		if req.Fingerprint.Hash == "" || len(req.Fingerprint.Sources) == 0 || req.Fingerprint.Hash != req.RuntimeVersion || !json.Valid(req.Fingerprint.Sources) {
			http.Error(w, "invalid source or fingerprint", 400)
			return
		}
		fingerprintHash, fingerprintSources, hasFingerprint = req.Fingerprint.Hash, req.Fingerprint.Sources, true
	}
	// Persist only the deliberately small Git provenance contract. Fingerprint
	// sources are a separate, immutable record of the native input surface.
	req.Source, _ = json.Marshal(source)
	f, _, e := r.FormFile("archive")
	if e != nil {
		http.Error(w, "archive required", 400)
		return
	}
	defer f.Close()
	tmp, e := os.CreateTemp("", "update-*.zip")
	if e != nil {
		s.logError(r, "publish: create temp file", e)
		http.Error(w, "temp", 500)
		return
	}
	defer os.Remove(tmp.Name())
	if _, e = io.Copy(tmp, f); e != nil {
		s.logError(r, "publish: copy archive to temp", e)
		http.Error(w, "archive", 400)
		return
	}
	_ = tmp.Close()
	zr, e := zip.OpenReader(tmp.Name())
	if e != nil {
		http.Error(w, "invalid zip", 400)
		return
	}
	defer zr.Close()
	files := map[string]*zip.File{}
	for _, z := range zr.File {
		if strings.HasPrefix(z.Name, "/") || strings.Contains(z.Name, "..") {
			http.Error(w, "unsafe archive path", 400)
			return
		}
		files[strings.ReplaceAll(z.Name, "\\", "/")] = z
	}
	read := func(n string) ([]byte, error) {
		z := files[n]
		if z == nil {
			return nil, os.ErrNotExist
		}
		x, e := z.Open()
		if e != nil {
			return nil, e
		}
		defer x.Close()
		return io.ReadAll(x)
	}
	mb, e := read("metadata.json")
	if e != nil {
		http.Error(w, "metadata.json missing", 400)
		return
	}
	cb, e := read("expoConfig.json")
	if e != nil {
		http.Error(w, "expoConfig.json missing", 400)
		return
	}
	var meta exportMeta
	if json.Unmarshal(mb, &meta) != nil || len(meta.FileMetadata) == 0 {
		http.Error(w, "invalid metadata.json", 400)
		return
	}
	var cfg any
	if json.Unmarshal(cb, &cfg) != nil {
		http.Error(w, "invalid expoConfig.json", 400)
		return
	}
	gid := uuid.New()
	tx, e := s.DB.Pool.Begin(r.Context())
	if e != nil {
		s.logError(r, "publish: begin transaction", e, "group_id", gid.String())
		http.Error(w, "database", 500)
		return
	}
	defer tx.Rollback(r.Context())
	txq := s.DB.Queries.WithTx(tx)
	_ = cfg // JSON validation above intentionally precedes persistence.
	e = txq.InsertUpdateGroup(r.Context(), db.InsertUpdateGroupParams{ID: pgUUID(&gid), Channel: req.Channel, RuntimeVersion: req.RuntimeVersion, Message: req.Message, Source: req.Source, FingerprintHash: pgtype.Text{String: fingerprintHash, Valid: hasFingerprint}, FingerprintSources: fingerprintSources, ExpoConfig: cb, MetadataSha256: sha(mb)})
	if e != nil {
		s.logError(r, "publish: insert update group", e, "group_id", gid.String(), "channel", req.Channel, "runtime_version", req.RuntimeVersion)
		http.Error(w, "database", 500)
		return
	}
	for platform, m := range meta.FileMetadata {
		if platform != "android" && platform != "ios" {
			continue
		}
		// Capture the currently visible launch bundle before the channel pointer
		// changes. The worker will create exactly this adjacent-head patch.
		var previousUpdate *uuid.UUID
		previous, err := txq.GetPreviousChannelUpdate(r.Context(), db.GetPreviousChannelUpdateParams{Channel: req.Channel, RuntimeVersion: req.RuntimeVersion, Platform: platform})
		if err == nil {
			id := uuid.UUID(previous.Bytes)
			previousUpdate = &id
		}
		if errors.Is(err, pgx.ErrNoRows) {
			previousUpdate = nil
		} else if err != nil {
			s.logError(r, "publish: query previous channel update", err, "group_id", gid.String(), "channel", req.Channel, "runtime_version", req.RuntimeVersion, "platform", platform)
			http.Error(w, "database", 500)
			return
		}

		bundle, e := read(m.Bundle)
		if e != nil {
			http.Error(w, "bundle missing", 400)
			return
		}
		uid := uuid.New()
		launchKey := path.Base(m.Bundle)
		object := path.Join("updates", gid.String(), platform, m.Bundle)
		if e = s.Objects.Put(r.Context(), object, "application/javascript", bundle); e != nil {
			s.logError(r, "publish: upload launch bundle", e, "group_id", gid.String(), "platform", platform, "object", object)
			http.Error(w, "r2 upload", 502)
			return
		}
		e = txq.InsertUpdate(r.Context(), db.InsertUpdateParams{ID: pgUUID(&uid), GroupID: pgUUID(&gid), Platform: platform, LaunchKey: launchKey, LaunchHash: sha(bundle)})
		if e != nil {
			s.logError(r, "publish: insert update", e, "group_id", gid.String(), "platform", platform)
			http.Error(w, "database", 500)
			return
		}
		e = txq.InsertAsset(r.Context(), db.InsertAssetParams{UpdateID: pgUUID(&uid), AssetKey: launchKey, ObjectKey: object, Sha256: sha(bundle), ContentType: "application/javascript", SizeBytes: int64(len(bundle)), IsLaunch: true})
		if e != nil {
			s.logError(r, "publish: insert launch asset", e, "group_id", gid.String(), "platform", platform)
			http.Error(w, "database", 500)
			return
		}
		for _, a := range m.Assets {
			b, e := read(a.Path)
			if e != nil {
				http.Error(w, "asset missing", 400)
				return
			}
			k := path.Base(a.Path)
			ct := mime.TypeByExtension("." + a.Ext)
			if ct == "" {
				ct = "application/octet-stream"
			}
			obj := path.Join("updates", gid.String(), platform, a.Path)
			if e = s.Objects.Put(r.Context(), obj, ct, b); e != nil {
				s.logError(r, "publish: upload asset", e, "group_id", gid.String(), "platform", platform, "object", obj)
				http.Error(w, "r2 upload", 502)
				return
			}
			e = txq.InsertAsset(r.Context(), db.InsertAssetParams{UpdateID: pgUUID(&uid), AssetKey: k, ObjectKey: obj, Sha256: sha(b), ContentType: ct, SizeBytes: int64(len(b))})
			if e != nil {
				s.logError(r, "publish: insert asset", e, "group_id", gid.String(), "platform", platform, "object", obj)
				http.Error(w, "database", 500)
				return
			}
		}
		if previousUpdate != nil {
			e = txq.InsertPendingPatch(r.Context(), db.InsertPendingPatchParams{FromUpdateID: pgUUID(previousUpdate), ToUpdateID: pgUUID(&uid), Platform: platform})
			if e != nil {
				s.logError(r, "publish: insert pending patch", e, "group_id", gid.String(), "platform", platform, "from", previousUpdate.String(), "to", uid.String())
				http.Error(w, "database", 500)
				return
			}
		}
		e = txq.UpsertChannelHead(r.Context(), db.UpsertChannelHeadParams{Channel: req.Channel, RuntimeVersion: req.RuntimeVersion, Platform: platform, GroupID: pgUUID(&gid), Mode: "ota"})
		if e == nil {
			e = txq.InsertChannelHistory(r.Context(), db.InsertChannelHistoryParams{Channel: req.Channel, RuntimeVersion: req.RuntimeVersion, Platform: platform, GroupID: pgUUID(&gid), Mode: "ota", Action: "publish", Actor: pgtype.Text{String: "admin", Valid: true}})
		}
		if e != nil {
			s.logError(r, "publish: point channel head", e, "group_id", gid.String(), "channel", req.Channel, "runtime_version", req.RuntimeVersion, "platform", platform)
		}
	}
	if e = tx.Commit(r.Context()); e != nil {
		s.logError(r, "publish: commit transaction", e, "group_id", gid.String())
		http.Error(w, "database", 500)
		return
	}
	writeJSON(w, 201, map[string]any{"group_id": gid})
}
