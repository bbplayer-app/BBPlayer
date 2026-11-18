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
	"golang.org/x/sync/errgroup"
)

type publishRequest struct {
	Channel        string              `json:"channel"`
	RuntimeVersion string              `json:"runtime_version"`
	Message        string              `json:"message"`
	Source         json.RawMessage     `json:"source"`
	Fingerprint    *publishFingerprint `json:"fingerprint,omitempty"`
}
type publishFingerprint struct {
	Hash    string          `json:"hash"`
	Sources json.RawMessage `json:"sources"`
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

// publishUploadConcurrency bounds parallel R2 uploads during a publish.
const publishUploadConcurrency = 8

type publishObject struct {
	key, object, contentType string
	body                     []byte
}

type publishPlatform struct {
	name   string
	launch publishObject
	assets []publishObject
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
	if req.Fingerprint != nil {
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
		return nil, s.dbError("publish: create temp file", err)
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
	_ = cfg // JSON validation above intentionally precedes persistence.

	// Read every object out of the archive and upload them all to R2 before the
	// transaction opens. Uploads run concurrently: done one by one an export with
	// many assets outlasts the reverse proxy's timeout, and holding a database
	// transaction open across that many network round trips is wasteful anyway.
	var platforms []publishPlatform
	var uploads []publishObject
	for platform, m := range meta.FileMetadata {
		if platform != "android" && platform != "ios" {
			continue
		}
		bundle, e := read(m.Bundle)
		if e != nil {
			return nil, huma.Error400BadRequest("bundle missing")
		}
		p := publishPlatform{name: platform, launch: publishObject{key: path.Base(m.Bundle), object: path.Join("updates", gid.String(), platform, m.Bundle), contentType: "application/javascript", body: bundle}}
		for _, a := range m.Assets {
			b, e := read(a.Path)
			if e != nil {
				return nil, huma.Error400BadRequest("asset missing")
			}
			ct := mime.TypeByExtension("." + a.Ext)
			if ct == "" {
				ct = "application/octet-stream"
			}
			p.assets = append(p.assets, publishObject{key: path.Base(a.Path), object: path.Join("updates", gid.String(), platform, a.Path), contentType: ct, body: b})
		}
		platforms = append(platforms, p)
		uploads = append(uploads, p.launch)
		uploads = append(uploads, p.assets...)
	}
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(publishUploadConcurrency)
	for _, o := range uploads {
		g.Go(func() error {
			if e := s.Objects.Put(gctx, o.object, o.contentType, o.body); e != nil {
				s.Log.Error("publish: upload object", "error", e, "group_id", gid.String(), "object", o.object)
				return e
			}
			return nil
		})
	}
	if g.Wait() != nil {
		return nil, huma.NewError(http.StatusBadGateway, "r2 upload")
	}

	tx, e := s.DB.Pool.Begin(ctx)
	if e != nil {
		return nil, s.dbError("publish: begin transaction", e, "group_id", gid.String())
	}
	defer tx.Rollback(ctx)
	txq := s.DB.Queries.WithTx(tx)
	e = txq.InsertUpdateGroup(ctx, db.InsertUpdateGroupParams{ID: pgUUID(&gid), Channel: req.Channel, RuntimeVersion: req.RuntimeVersion, Message: req.Message, Source: req.Source, FingerprintHash: pgtype.Text{String: fingerprintHash, Valid: hasFingerprint}, FingerprintSources: fingerprintSources, ExpoConfig: cb, MetadataSha256: sha(mb)})
	if e != nil {
		return nil, s.dbError("publish: insert update group", e, "group_id", gid.String(), "channel", req.Channel, "runtime_version", req.RuntimeVersion)
	}
	for _, p := range platforms {
		platform := p.name
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
			return nil, s.dbError("publish: query previous channel update", err, "group_id", gid.String(), "channel", req.Channel, "runtime_version", req.RuntimeVersion, "platform", platform)
		}

		uid := uuid.New()
		e = txq.InsertUpdate(ctx, db.InsertUpdateParams{ID: pgUUID(&uid), GroupID: pgUUID(&gid), Platform: platform, LaunchKey: p.launch.key, LaunchHash: sha(p.launch.body)})
		if e != nil {
			return nil, s.dbError("publish: insert update", e, "group_id", gid.String(), "platform", platform)
		}
		e = txq.InsertAsset(ctx, db.InsertAssetParams{UpdateID: pgUUID(&uid), AssetKey: p.launch.key, ObjectKey: p.launch.object, Sha256: sha(p.launch.body), ContentType: p.launch.contentType, SizeBytes: int64(len(p.launch.body)), IsLaunch: true})
		if e != nil {
			return nil, s.dbError("publish: insert launch asset", e, "group_id", gid.String(), "platform", platform)
		}
		for _, a := range p.assets {
			e = txq.InsertAsset(ctx, db.InsertAssetParams{UpdateID: pgUUID(&uid), AssetKey: a.key, ObjectKey: a.object, Sha256: sha(a.body), ContentType: a.contentType, SizeBytes: int64(len(a.body))})
			if e != nil {
				return nil, s.dbError("publish: insert asset", e, "group_id", gid.String(), "platform", platform, "object", a.object)
			}
		}
		if previousUpdate != nil {
			e = txq.InsertPendingPatch(ctx, db.InsertPendingPatchParams{FromUpdateID: pgUUID(previousUpdate), ToUpdateID: pgUUID(&uid), Platform: platform})
			if e != nil {
				return nil, s.dbError("publish: insert pending patch", e, "group_id", gid.String(), "platform", platform, "from", previousUpdate.String(), "to", uid.String())
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
		return nil, s.dbError("publish: commit transaction", e, "group_id", gid.String())
	}
	s.Log.Info("publish completed", "group_id", gid.String(), "channel", req.Channel, "runtime_version", req.RuntimeVersion, "commit_sha", source.CommitSHA, "clean", source.WorkingTreeClean, "message", req.Message)
	out := &adminPublishOutput{}
	out.Body.GroupID = gid
	return out, nil
}
