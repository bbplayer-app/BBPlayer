package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type adminListUpdatesInput struct {
	Limit  int32 `query:"limit" default:"10" minimum:"1" maximum:"100" doc:"Maximum number of update groups."`
	Offset int32 `query:"offset" default:"0" minimum:"0" doc:"Number of update groups to skip."`
}

type adminUpdateGroup struct {
	ID                      uuid.UUID       `json:"id"`
	Channel                 string          `json:"channel"`
	RuntimeVersion          string          `json:"runtime_version"`
	AppVersion              string          `json:"app_version"`
	Message                 string          `json:"message"`
	CreatedAt               time.Time       `json:"created_at"`
	Source                  json.RawMessage `json:"source"`
	FingerprintHash         *string         `json:"fingerprint_hash,omitempty"`
	RepublishedFromUpdateID *uuid.UUID      `json:"republished_from_update_id,omitempty"`
}

type adminListUpdatesOutput struct {
	Body []adminUpdateGroup
}

type adminGetUpdateInput struct {
	ID uuid.UUID `path:"id" doc:"Update group UUID."`
}

type adminFingerprint struct {
	Hash    *string         `json:"hash,omitempty"`
	Sources json.RawMessage `json:"sources"`
}

type adminGetUpdateOutput struct {
	Body struct {
		adminUpdateGroup
		Fingerprint adminFingerprint `json:"fingerprint"`
	}
}

type adminChannelHead struct {
	Channel        string    `json:"channel,omitempty"`
	RuntimeVersion string    `json:"runtime_version"`
	Platform       string    `json:"platform"`
	GroupID        uuid.UUID `json:"group_id"`
	Mode           string    `json:"mode"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type adminListChannelsOutput struct {
	Body []adminChannelHead
}

type adminChannelInput struct {
	Channel string `path:"channel" minLength:"1"`
}
type adminChannelHistory struct {
	GroupID   uuid.UUID `json:"group_id"`
	Mode      string    `json:"mode"`
	Action    string    `json:"action"`
	CreatedAt time.Time `json:"created_at"`
}
type adminChannelHistoryOutput struct{ Body []adminChannelHistory }
type adminRepublishInput struct {
	Channel string `path:"channel" minLength:"1"`
	Body    adminRepublishBody
}

type adminSetEmbeddedInput struct {
	Channel string `path:"channel" minLength:"1"`
	Body    adminSetEmbeddedBody
}

type adminRepublishBody struct {
	RuntimeVersion string    `json:"runtime_version" minLength:"1"`
	Platform       string    `json:"platform" enum:"android,ios"`
	GroupID        uuid.UUID `json:"group_id"`
	Message        string    `json:"message" minLength:"1" maxLength:"200"`
}

type adminSetEmbeddedBody struct {
	RuntimeVersion string    `json:"runtime_version" minLength:"1"`
	Platform       string    `json:"platform" enum:"android,ios"`
	GroupID        uuid.UUID `json:"group_id"`
}
type adminStatusOutput struct {
	Body struct {
		Status  string     `json:"status"`
		GroupID *uuid.UUID `json:"group_id,omitempty"`
	}
}

func registerAdminUpdateRoutes(s *Server, api huma.API) {
	security := []map[string][]string{{adminSecurityScheme: {}}}
	huma.Register(api, huma.Operation{OperationID: "listUpdateGroups", Method: http.MethodGet, Path: "/admin/updates", Summary: "List update groups", Tags: []string{"Updates"}, Security: security, Errors: []int{http.StatusInternalServerError}}, s.listUpdates)
	huma.Register(api, huma.Operation{OperationID: "getUpdateGroup", Method: http.MethodGet, Path: "/admin/updates/{id}", Summary: "Get update group", Tags: []string{"Updates"}, Security: security, Errors: []int{http.StatusNotFound}}, s.getUpdate)
	huma.Register(api, huma.Operation{OperationID: "listChannelHeads", Method: http.MethodGet, Path: "/admin/channels", Summary: "List channel heads", Tags: []string{"Channels"}, Security: security, Errors: []int{http.StatusInternalServerError}}, s.listChannels)
}

func registerAdminChannelRoutes(s *Server, api huma.API) {
	security := []map[string][]string{{adminSecurityScheme: {}}}
	huma.Register(api, huma.Operation{OperationID: "getChannelHeads", Method: http.MethodGet, Path: "/admin/channels/{channel}", Summary: "Get channel heads", Tags: []string{"Channels"}, Security: security}, s.channel)
	huma.Register(api, huma.Operation{OperationID: "republishChannel", Method: http.MethodPost, Path: "/admin/channels/{channel}/republish", Summary: "Republish a historical update", Tags: []string{"Channels"}, Security: security, Errors: []int{http.StatusBadRequest}}, s.republish)
	huma.Register(api, huma.Operation{OperationID: "setChannelEmbedded", Method: http.MethodPost, Path: "/admin/channels/{channel}/embedded", Summary: "Revert a channel head to its embedded bundle", Tags: []string{"Channels"}, Security: security, Errors: []int{http.StatusBadRequest}}, s.setEmbedded)
	huma.Register(api, huma.Operation{OperationID: "getChannelHistory", Method: http.MethodGet, Path: "/admin/channels/{channel}/history", Summary: "Get channel history", Tags: []string{"Channels"}, Security: security}, s.history)
}

func (s *Server) listUpdates(ctx context.Context, input *adminListUpdatesInput) (*adminListUpdatesOutput, error) {
	rows, err := s.DB.Queries.ListUpdateGroups(ctx, db.ListUpdateGroupsParams{Limit: input.Limit, Offset: input.Offset})
	if err != nil {
		return nil, s.dbError("updates: list", err)
	}
	out := &adminListUpdatesOutput{Body: make([]adminUpdateGroup, 0, len(rows))}
	for _, row := range rows {
		item := adminUpdateGroup{ID: uuid.UUID(row.ID.Bytes), Channel: row.Channel, RuntimeVersion: row.RuntimeVersion, AppVersion: row.AppVersion, Message: row.Message, CreatedAt: row.CreatedAt.Time, Source: row.Source}
		if row.FingerprintHash.Valid {
			value := row.FingerprintHash.String
			item.FingerprintHash = &value
		}
		if row.RepublishedFromUpdateID.Valid {
			value := uuid.UUID(row.RepublishedFromUpdateID.Bytes)
			item.RepublishedFromUpdateID = &value
		}
		out.Body = append(out.Body, item)
	}
	return out, nil
}

func (s *Server) getUpdate(ctx context.Context, input *adminGetUpdateInput) (*adminGetUpdateOutput, error) {
	group, err := s.DB.Queries.GetUpdateGroup(ctx, pgtype.UUID{Bytes: [16]byte(input.ID), Valid: true})
	if err == pgx.ErrNoRows {
		return nil, huma.Error404NotFound("update group not found")
	}
	if err != nil {
		return nil, s.dbError("updates: get", err)
	}
	out := &adminGetUpdateOutput{}
	out.Body.adminUpdateGroup = adminUpdateGroup{ID: input.ID, Channel: group.Channel, RuntimeVersion: group.RuntimeVersion, Message: group.Message, CreatedAt: group.CreatedAt.Time, Source: group.Source}
	if group.FingerprintHash.Valid {
		value := group.FingerprintHash.String
		out.Body.FingerprintHash = &value
	}
	if group.RepublishedFromUpdateID.Valid {
		value := uuid.UUID(group.RepublishedFromUpdateID.Bytes)
		out.Body.RepublishedFromUpdateID = &value
	}
	out.Body.Fingerprint = adminFingerprint{Hash: out.Body.FingerprintHash, Sources: group.FingerprintSources}
	return out, nil
}

func (s *Server) listChannels(ctx context.Context, _ *struct{}) (*adminListChannelsOutput, error) {
	rows, err := s.DB.Queries.ListChannelHeads(ctx)
	if err != nil {
		return nil, s.dbError("updates: channel heads", err)
	}
	out := &adminListChannelsOutput{Body: make([]adminChannelHead, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminChannelHead{Channel: row.Channel, RuntimeVersion: row.RuntimeVersion, Platform: row.Platform, GroupID: uuid.UUID(row.GroupID.Bytes), Mode: row.Mode, UpdatedAt: row.UpdatedAt.Time})
	}
	return out, nil
}

func (s *Server) channel(ctx context.Context, input *adminChannelInput) (*adminListChannelsOutput, error) {
	rows, err := s.DB.Queries.ListChannelHeadsByChannel(ctx, input.Channel)
	if err != nil {
		return nil, s.dbError("updates: channel heads by channel", err)
	}
	out := &adminListChannelsOutput{Body: make([]adminChannelHead, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminChannelHead{RuntimeVersion: row.RuntimeVersion, Platform: row.Platform, GroupID: uuid.UUID(row.GroupID.Bytes), Mode: row.Mode, UpdatedAt: row.UpdatedAt.Time})
	}
	return out, nil
}

func (s *Server) history(ctx context.Context, input *adminChannelInput) (*adminChannelHistoryOutput, error) {
	rows, err := s.DB.Queries.ListChannelHistory(ctx, input.Channel)
	if err != nil {
		return nil, s.dbError("updates: channel history", err)
	}
	out := &adminChannelHistoryOutput{Body: make([]adminChannelHistory, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminChannelHistory{GroupID: uuid.UUID(row.GroupID.Bytes), Mode: row.Mode, Action: row.Action, CreatedAt: row.CreatedAt.Time})
	}
	return out, nil
}

func (s *Server) republish(ctx context.Context, input *adminRepublishInput) (*adminStatusOutput, error) {
	input.Body.Message = strings.TrimSpace(input.Body.Message)
	if input.Body.Message == "" {
		return nil, huma.Error400BadRequest("message required")
	}
	compatible, err := s.DB.Queries.IsCompatibleUpdateGroup(ctx, db.IsCompatibleUpdateGroupParams{ID: pgUUID(&input.Body.GroupID), Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform})
	if err != nil {
		return nil, s.dbError("updates: compatibility check", err)
	}
	if !compatible {
		return nil, huma.Error400BadRequest("incompatible update group")
	}
	groupID, err := s.republishOTA(ctx, input)
	if err != nil {
		return nil, err
	}
	out := &adminStatusOutput{}
	out.Body.Status = "republished"
	out.Body.GroupID = &groupID
	return out, nil
}

func (s *Server) setEmbedded(ctx context.Context, input *adminSetEmbeddedInput) (*adminStatusOutput, error) {
	compatible, err := s.DB.Queries.IsCompatibleUpdateGroup(ctx, db.IsCompatibleUpdateGroupParams{ID: pgUUID(&input.Body.GroupID), Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform})
	if err != nil {
		return nil, s.dbError("embedded: compatibility check", err)
	}
	if !compatible {
		return nil, huma.Error400BadRequest("incompatible update group")
	}
	tx, err := s.DB.Pool.Begin(ctx)
	if err != nil {
		return nil, s.dbError("embedded: begin transaction", err)
	}
	defer tx.Rollback(ctx)
	txq := s.DB.Queries.WithTx(tx)
	if err = txq.UpsertChannelHead(ctx, db.UpsertChannelHeadParams{Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform, Mode: "embedded"}); err != nil {
		return nil, s.dbError("embedded: point channel head", err, "channel", input.Channel, "runtime_version", input.Body.RuntimeVersion, "platform", input.Body.Platform)
	}
	if err = txq.InsertChannelHistory(ctx, db.InsertChannelHistoryParams{Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform, GroupID: pgUUID(&input.Body.GroupID), Mode: "embedded", Action: "revert_to_embedded", Actor: pgtype.Text{String: "admin", Valid: true}}); err != nil {
		return nil, s.dbError("embedded: insert channel history", err, "channel", input.Channel, "runtime_version", input.Body.RuntimeVersion, "platform", input.Body.Platform)
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, s.dbError("embedded: commit", err, "channel", input.Channel, "runtime_version", input.Body.RuntimeVersion, "platform", input.Body.Platform)
	}
	s.Log.Info("channel head reverted to embedded bundle", "channel", input.Channel, "runtime_version", input.Body.RuntimeVersion, "platform", input.Body.Platform, "from_group_id", input.Body.GroupID.String())
	out := &adminStatusOutput{}
	out.Body.Status = "embedded"
	return out, nil
}

// republishOTA republishes the historical update as a new update. Expo Updates
// deliberately will not select an older manifest, so merely repointing a
// channel head cannot roll an already-updated device back.
func (s *Server) republishOTA(ctx context.Context, input *adminRepublishInput) (uuid.UUID, error) {
	targetGroupID := input.Body.GroupID
	tx, err := s.DB.Pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, s.dbError("republish: begin transaction", err)
	}
	defer tx.Rollback(ctx)
	txq := s.DB.Queries.WithTx(tx)

	targetGroup, err := txq.GetUpdateGroup(ctx, pgUUID(&targetGroupID))
	if err != nil {
		return uuid.Nil, s.dbError("republish: get target group", err, "group_id", targetGroupID.String())
	}
	targetUpdate, err := txq.GetUpdateForGroupPlatform(ctx, db.GetUpdateForGroupPlatformParams{GroupID: pgUUID(&targetGroupID), Platform: input.Body.Platform})
	if err != nil {
		return uuid.Nil, s.dbError("republish: get target update", err, "group_id", targetGroupID.String(), "platform", input.Body.Platform)
	}
	assets, err := txq.ListAssetsForUpdate(ctx, targetUpdate.ID)
	if err != nil {
		return uuid.Nil, s.dbError("republish: list target assets", err, "update_id", uuid.UUID(targetUpdate.ID.Bytes).String())
	}

	groupID := uuid.New()
	targetUpdateID := uuid.UUID(targetUpdate.ID.Bytes)
	if err = txq.InsertUpdateGroup(ctx, db.InsertUpdateGroupParams{
		ID: pgUUID(&groupID), Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion,
		Message: input.Body.Message, Source: targetGroup.Source,
		FingerprintHash: targetGroup.FingerprintHash, FingerprintSources: targetGroup.FingerprintSources,
		ExpoConfig: targetGroup.ExpoConfig, MetadataSha256: targetGroup.MetadataSha256,
		RepublishedFromUpdateID: pgUUID(&targetUpdateID),
	}); err != nil {
		return uuid.Nil, s.dbError("republish: insert update group", err, "group_id", groupID.String())
	}
	commits, err := txq.ListSourceCommits(ctx, pgUUID(&targetGroupID))
	if err != nil {
		return uuid.Nil, s.dbError("republish: list source commits", err, "group_id", targetGroupID.String())
	}
	for _, commit := range commits {
		if err = txq.InsertSourceCommit(ctx, db.InsertSourceCommitParams{UpdateGroupID: pgUUID(&groupID), Ordinal: commit.Ordinal, CommitSha: commit.CommitSha, ParentSha: commit.ParentSha, Subject: commit.Subject, AuthorName: commit.AuthorName, AuthoredAt: commit.AuthoredAt}); err != nil {
			return uuid.Nil, s.dbError("republish: copy source commit", err, "group_id", groupID.String())
		}
	}

	var previousUpdate *uuid.UUID
	previous, err := txq.GetPreviousChannelUpdate(ctx, db.GetPreviousChannelUpdateParams{Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform})
	if err == nil {
		value := uuid.UUID(previous.Bytes)
		previousUpdate = &value
	} else if err != pgx.ErrNoRows {
		return uuid.Nil, s.dbError("republish: get previous channel update", err, "channel", input.Channel, "runtime_version", input.Body.RuntimeVersion, "platform", input.Body.Platform)
	}

	updateID := uuid.New()
	if err = txq.InsertUpdate(ctx, db.InsertUpdateParams{ID: pgUUID(&updateID), GroupID: pgUUID(&groupID), Platform: input.Body.Platform, LaunchKey: targetUpdate.LaunchKey, LaunchHash: targetUpdate.LaunchHash}); err != nil {
		return uuid.Nil, s.dbError("republish: insert update", err, "group_id", groupID.String())
	}
	for _, asset := range assets {
		if err = txq.InsertAsset(ctx, db.InsertAssetParams{UpdateID: pgUUID(&updateID), AssetKey: asset.AssetKey, ObjectKey: asset.ObjectKey, Sha256: asset.Sha256, ContentType: asset.ContentType, SizeBytes: asset.SizeBytes, IsLaunch: asset.IsLaunch}); err != nil {
			return uuid.Nil, s.dbError("republish: reuse asset", err, "group_id", groupID.String(), "object", asset.ObjectKey)
		}
	}
	if previousUpdate != nil {
		if err = txq.InsertPendingPatch(ctx, db.InsertPendingPatchParams{FromUpdateID: pgUUID(previousUpdate), ToUpdateID: pgUUID(&updateID), Platform: input.Body.Platform}); err != nil {
			return uuid.Nil, s.dbError("republish: insert pending patch", err, "group_id", groupID.String())
		}
	}
	if err = txq.UpsertChannelHead(ctx, db.UpsertChannelHeadParams{Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform, GroupID: pgUUID(&groupID), Mode: "ota"}); err != nil {
		return uuid.Nil, s.dbError("republish: point channel head", err, "group_id", groupID.String())
	}
	if err = txq.InsertChannelHistory(ctx, db.InsertChannelHistoryParams{Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform, GroupID: pgUUID(&groupID), Mode: "ota", Action: "republish", Actor: pgtype.Text{String: "admin", Valid: true}}); err != nil {
		return uuid.Nil, s.dbError("republish: insert channel history", err, "group_id", groupID.String())
	}
	if err = tx.Commit(ctx); err != nil {
		return uuid.Nil, s.dbError("republish: commit", err, "group_id", groupID.String())
	}
	s.Log.Info("republish completed", "group_id", groupID.String(), "republished_from_update_id", targetUpdateID.String(), "channel", input.Channel, "runtime_version", input.Body.RuntimeVersion, "platform", input.Body.Platform)
	return groupID, nil
}
