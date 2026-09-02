package server

import (
	"archive/zip"
	"context"
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
	"github.com/danielgtaylor/huma/v2"
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

type adminPublishInput struct {
	RawBody huma.MultipartFormFiles[struct {
		Request publishRequest `form:"request" contentType:"application/json" required:"true"`
		Archive huma.FormFile  `form:"archive" contentType:"application/octet-stream" required:"true"`
	}]
}
type adminPublishOutput struct {
	Body struct {
		GroupID uuid.UUID `json:"group_id"`
	}
}

func registerAdminPublishRoute(s *Server, api huma.API) {
	huma.Register(api, huma.Operation{OperationID: "publishUpdate", Method: http.MethodPost, Path: "/admin/publish", Summary: "Publish update", Description: "Upload an Expo export ZIP and create an update group.", Tags: []string{"Updates"}, Security: []map[string][]string{{adminSecurityScheme: {}}}, DefaultStatus: http.StatusCreated, MaxBodyBytes: -1}, s.publish)
}

func (s *Server) publish(ctx context.Context, input *adminPublishInput) (*adminPublishOutput, error) {
	data := input.RawBody.Data()
	req := data.Request
	if req.Channel == "" || req.RuntimeVersion == "" || req.Message == "" || len(req.Source) == 0 {
		return nil, huma.Error400BadRequest("invalid publish request")
	}
	var source publishSource
	if json.Unmarshal(req.Source, &source) != nil || source.CommitSHA == "" {
		return nil, huma.Error400BadRequest("invalid source or fingerprint")
	}
	var fingerprintHash string
	var fingerprintSources []byte
	hasFingerprint := false
	if req.Fingerprint.Hash != "" || len(req.Fingerprint.Sources) != 0 {
		if req.Fingerprint.Hash == "" || len(req.Fingerprint.Sources) == 0 || req.Fingerprint.Hash != req.RuntimeVersion || !json.Valid(req.Fingerprint.Sources) {
			return nil, huma.Error400BadRequest("invalid source or fingerprint")
		}
		fingerprintHash, fingerprintSources, hasFingerprint = req.Fingerprint.Hash, req.Fingerprint.Sources, true
	}
	// Persist only the deliberately small Git provenance contract. Fingerprint
	// sources are a separate, immutable record of the native input surface.
	req.Source, _ = json.Marshal(source)
	archive, err := io.ReadAll(data.Archive)
	if err != nil {
		return nil, huma.Error400BadRequest("archive")
	}
	tmp, err := os.CreateTemp("", "update-*.zip")
	if err != nil {
		s.Log.Error("publish: create temp file", "error", err)
		return nil, huma.Error500InternalServerError("temp")
	}
	defer os.Remove(tmp.Name())
	if _, err = tmp.Write(archive); err != nil {
		_ = tmp.Close()
		s.Log.Error("publish: copy archive to temp", "error", err)
		return nil, huma.Error400BadRequest("archive")
	}
	_ = tmp.Close()
	zr, err := zip.OpenReader(tmp.Name())
	if err != nil {
		return nil, huma.Error400BadRequest("invalid zip")
	}
	defer zr.Close()
	files := map[string]*zip.File{}
	for _, z := range zr.File {
		if strings.HasPrefix(z.Name, "/") || strings.Contains(z.Name, "..") {
			return nil, huma.Error400BadRequest("unsafe archive path")
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
	mb, err := read("metadata.json")
	if err != nil {
		return nil, huma.Error400BadRequest("metadata.json missing")
	}
	cb, err := read("expoConfig.json")
	if err != nil {
		return nil, huma.Error400BadRequest("expoConfig.json missing")
	}
	var meta exportMeta
	if json.Unmarshal(mb, &meta) != nil || len(meta.FileMetadata) == 0 {
		return nil, huma.Error400BadRequest("invalid metadata.json")
	}
	var cfg any
	if json.Unmarshal(cb, &cfg) != nil {
		return nil, huma.Error400BadRequest("invalid expoConfig.json")
	}
	gid := uuid.New()
	tx, e := s.DB.Pool.Begin(ctx)
	if e != nil {
		s.Log.Error("publish: begin transaction", "error", e, "group_id", gid.String())
		return nil, huma.Error500InternalServerError("database")
	}
	defer tx.Rollback(ctx)
	txq := s.DB.Queries.WithTx(tx)
	_ = cfg // JSON validation above intentionally precedes persistence.
	e = txq.InsertUpdateGroup(ctx, db.InsertUpdateGroupParams{ID: pgUUID(&gid), Channel: req.Channel, RuntimeVersion: req.RuntimeVersion, Message: req.Message, Source: req.Source, FingerprintHash: pgtype.Text{String: fingerprintHash, Valid: hasFingerprint}, FingerprintSources: fingerprintSources, ExpoConfig: cb, MetadataSha256: sha(mb)})
	if e != nil {
		s.Log.Error("publish: insert update group", "error", e, "group_id", gid.String(), "channel", req.Channel, "runtime_version", req.RuntimeVersion)
		return nil, huma.Error500InternalServerError("database")
	}
	for platform, m := range meta.FileMetadata {
		if platform != "android" && platform != "ios" {
			continue
		}
		// Capture the currently visible launch bundle before the channel pointer
		// changes. The worker will create exactly this adjacent-head patch.
		var previousUpdate *uuid.UUID
		previous, err := txq.GetPreviousChannelUpdate(ctx, db.GetPreviousChannelUpdateParams{Channel: req.Channel, RuntimeVersion: req.RuntimeVersion, Platform: platform})
		if err == nil {
			id := uuid.UUID(previous.Bytes)
			previousUpdate = &id
		}
		if errors.Is(err, pgx.ErrNoRows) {
			previousUpdate = nil
		} else if err != nil {
			s.Log.Error("publish: query previous channel update", "error", err, "group_id", gid.String(), "channel", req.Channel, "runtime_version", req.RuntimeVersion, "platform", platform)
			return nil, huma.Error500InternalServerError("database")
		}

		bundle, e := read(m.Bundle)
		if e != nil {
			return nil, huma.Error400BadRequest("bundle missing")
		}
		uid := uuid.New()
		launchKey := path.Base(m.Bundle)
		object := path.Join("updates", gid.String(), platform, m.Bundle)
		if e = s.Objects.Put(ctx, object, "application/javascript", bundle); e != nil {
			s.Log.Error("publish: upload launch bundle", "error", e, "group_id", gid.String(), "platform", platform, "object", object)
			return nil, huma.NewError(http.StatusBadGateway, "r2 upload")
		}
		e = txq.InsertUpdate(ctx, db.InsertUpdateParams{ID: pgUUID(&uid), GroupID: pgUUID(&gid), Platform: platform, LaunchKey: launchKey, LaunchHash: sha(bundle)})
		if e != nil {
			s.Log.Error("publish: insert update", "error", e, "group_id", gid.String(), "platform", platform)
			return nil, huma.Error500InternalServerError("database")
		}
		e = txq.InsertAsset(ctx, db.InsertAssetParams{UpdateID: pgUUID(&uid), AssetKey: launchKey, ObjectKey: object, Sha256: sha(bundle), ContentType: "application/javascript", SizeBytes: int64(len(bundle)), IsLaunch: true})
		if e != nil {
			s.Log.Error("publish: insert launch asset", "error", e, "group_id", gid.String(), "platform", platform)
			return nil, huma.Error500InternalServerError("database")
		}
		for _, a := range m.Assets {
			b, e := read(a.Path)
			if e != nil {
				return nil, huma.Error400BadRequest("asset missing")
			}
			k := path.Base(a.Path)
			ct := mime.TypeByExtension("." + a.Ext)
			if ct == "" {
				ct = "application/octet-stream"
			}
			obj := path.Join("updates", gid.String(), platform, a.Path)
			if e = s.Objects.Put(ctx, obj, ct, b); e != nil {
				s.Log.Error("publish: upload asset", "error", e, "group_id", gid.String(), "platform", platform, "object", obj)
				return nil, huma.NewError(http.StatusBadGateway, "r2 upload")
			}
			e = txq.InsertAsset(ctx, db.InsertAssetParams{UpdateID: pgUUID(&uid), AssetKey: k, ObjectKey: obj, Sha256: sha(b), ContentType: ct, SizeBytes: int64(len(b))})
			if e != nil {
				s.Log.Error("publish: insert asset", "error", e, "group_id", gid.String(), "platform", platform, "object", obj)
				return nil, huma.Error500InternalServerError("database")
			}
		}
		if previousUpdate != nil {
			e = txq.InsertPendingPatch(ctx, db.InsertPendingPatchParams{FromUpdateID: pgUUID(previousUpdate), ToUpdateID: pgUUID(&uid), Platform: platform})
			if e != nil {
				s.Log.Error("publish: insert pending patch", "error", e, "group_id", gid.String(), "platform", platform, "from", previousUpdate.String(), "to", uid.String())
				return nil, huma.Error500InternalServerError("database")
			}
		}
		e = txq.UpsertChannelHead(ctx, db.UpsertChannelHeadParams{Channel: req.Channel, RuntimeVersion: req.RuntimeVersion, Platform: platform, GroupID: pgUUID(&gid), Mode: "ota"})
		if e == nil {
			e = txq.InsertChannelHistory(ctx, db.InsertChannelHistoryParams{Channel: req.Channel, RuntimeVersion: req.RuntimeVersion, Platform: platform, GroupID: pgUUID(&gid), Mode: "ota", Action: "publish", Actor: pgtype.Text{String: "admin", Valid: true}})
		}
		if e != nil {
			s.Log.Error("publish: point channel head", "error", e, "group_id", gid.String(), "channel", req.Channel, "runtime_version", req.RuntimeVersion, "platform", platform)
		}
	}
	if e = tx.Commit(ctx); e != nil {
		s.Log.Error("publish: commit transaction", "error", e, "group_id", gid.String())
		return nil, huma.Error500InternalServerError("database")
	}
	out := &adminPublishOutput{}
	out.Body.GroupID = gid
	return out, nil
}
