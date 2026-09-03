package server

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

type adminListPatchesInput struct {
	Limit int32 `query:"limit" default:"100" minimum:"1" maximum:"500" doc:"Maximum number of patches."`
}

type adminPatchUpdateRef struct {
	UpdateID uuid.UUID `json:"update_id"`
	GroupID  uuid.UUID `json:"group_id"`
	Channel  string    `json:"channel"`
	Runtime  string    `json:"runtime_version"`
	Message  string    `json:"message"`
	Version  string    `json:"version"`
}

type adminPatch struct {
	ID                  int64               `json:"id"`
	Platform            string              `json:"platform"`
	Status              string              `json:"status" doc:"pending, processing, ready, failed or not_beneficial."`
	ObjectKey           *string             `json:"object_key,omitempty"`
	Sha256              *string             `json:"sha256,omitempty"`
	SizeBytes           *int64              `json:"size_bytes,omitempty"`
	Attempts            int32               `json:"attempts"`
	ServedCount         int64               `json:"served_count"`
	TargetSize          int64               `json:"target_size"`
	Error               *string             `json:"error,omitempty"`
	ProcessingStartedAt *time.Time          `json:"processing_started_at,omitempty"`
	CreatedAt           time.Time           `json:"created_at"`
	UpdatedAt           time.Time           `json:"updated_at"`
	From                adminPatchUpdateRef `json:"from"`
	To                  adminPatchUpdateRef `json:"to"`
}

type adminListPatchesOutput struct {
	Body []adminPatch
}

func registerAdminPatchRoutes(s *Server, api huma.API) {
	security := []map[string][]string{{adminSecurityScheme: {}}}
	huma.Register(api, huma.Operation{OperationID: "listPatches", Method: http.MethodGet, Path: "/admin/patches", Summary: "List patch generation status", Tags: []string{"Patches"}, Security: security, Errors: []int{http.StatusInternalServerError}}, s.listPatches)
}

func (s *Server) listPatches(ctx context.Context, input *adminListPatchesInput) (*adminListPatchesOutput, error) {
	rows, err := s.DB.Queries.ListPatches(ctx, input.Limit)
	if err != nil {
		return nil, s.dbError("patches: list", err)
	}
	out := &adminListPatchesOutput{Body: make([]adminPatch, 0, len(rows))}
	for _, row := range rows {
		item := adminPatch{
			ID: row.ID, Platform: row.Platform, Status: row.Status,
			Attempts: row.Attempts, ServedCount: row.ServedCount, TargetSize: row.TargetSize,
			CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
			From: adminPatchUpdateRef{UpdateID: uuid.UUID(row.FromUpdateID.Bytes), GroupID: uuid.UUID(row.FromGroupID.Bytes), Channel: row.FromChannel, Runtime: row.FromRuntime, Message: row.FromMessage, Version: row.FromVersion},
			To:   adminPatchUpdateRef{UpdateID: uuid.UUID(row.ToUpdateID.Bytes), GroupID: uuid.UUID(row.ToGroupID.Bytes), Channel: row.ToChannel, Runtime: row.ToRuntime, Message: row.ToMessage, Version: row.ToVersion},
		}
		if row.ObjectKey.Valid {
			item.ObjectKey = &row.ObjectKey.String
		}
		if row.Sha256.Valid {
			item.Sha256 = &row.Sha256.String
		}
		if row.SizeBytes.Valid {
			value := row.SizeBytes.Int64
			item.SizeBytes = &value
		}
		if row.Error.Valid {
			item.Error = &row.Error.String
		}
		if row.ProcessingStartedAt.Valid {
			value := row.ProcessingStartedAt.Time
			item.ProcessingStartedAt = &value
		}
		out.Body = append(out.Body, item)
	}
	return out, nil
}
