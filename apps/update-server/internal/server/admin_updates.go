package server

import (
	"context"
	"encoding/json"
	"net/http"
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
	ID              uuid.UUID       `json:"id"`
	Channel         string          `json:"channel"`
	RuntimeVersion  string          `json:"runtime_version"`
	AppVersion      string          `json:"app_version"`
	Message         string          `json:"message"`
	CreatedAt       time.Time       `json:"created_at"`
	Source          json.RawMessage `json:"source"`
	FingerprintHash *string         `json:"fingerprint_hash,omitempty"`
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
type adminRollbackInput struct {
	Channel string `path:"channel" minLength:"1"`
	Body    adminRollbackBody
}
type adminRollbackBody struct {
	RuntimeVersion string     `json:"runtime_version" minLength:"1"`
	Platform       string     `json:"platform" enum:"android,ios"`
	Mode           string     `json:"mode" enum:"ota,embedded"`
	GroupID        *uuid.UUID `json:"group_id,omitempty"`
}
type adminStatusOutput struct {
	Body struct {
		Status string `json:"status"`
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
	huma.Register(api, huma.Operation{OperationID: "rollbackChannel", Method: http.MethodPost, Path: "/admin/channels/{channel}/rollback", Summary: "Roll back channel", Tags: []string{"Channels"}, Security: security, Errors: []int{http.StatusBadRequest}}, s.rollback)
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

func (s *Server) rollback(ctx context.Context, input *adminRollbackInput) (*adminStatusOutput, error) {
	var groupID *uuid.UUID
	if input.Body.Mode == "ota" {
		if input.Body.GroupID == nil {
			return nil, huma.Error400BadRequest("group_id required for ota rollback")
		}
		groupID = input.Body.GroupID
		compatible, err := s.DB.Queries.IsCompatibleUpdateGroup(ctx, db.IsCompatibleUpdateGroupParams{ID: pgUUID(groupID), Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform})
		if err != nil {
			return nil, s.dbError("updates: compatibility check", err)
		}
		if !compatible {
			return nil, huma.Error400BadRequest("incompatible update group")
		}
	}
	if err := s.DB.Queries.UpsertChannelHead(ctx, db.UpsertChannelHeadParams{Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform, GroupID: pgUUID(groupID), Mode: input.Body.Mode}); err != nil {
		return nil, s.dbError("updates: rollback head", err)
	}
	if err := s.DB.Queries.InsertChannelHistory(ctx, db.InsertChannelHistoryParams{Channel: input.Channel, RuntimeVersion: input.Body.RuntimeVersion, Platform: input.Body.Platform, GroupID: pgUUID(groupID), Mode: input.Body.Mode, Action: "rollback", Actor: pgtype.Text{String: "admin", Valid: true}}); err != nil {
		s.Log.Error("rollback: insert channel history", "error", err)
	}
	out := &adminStatusOutput{}
	out.Body.Status = "rolled back"
	return out, nil
}
