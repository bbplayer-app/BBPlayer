package server

import (
	"encoding/json"
	"net/http"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (s *Server) rollback(w http.ResponseWriter, r *http.Request) {
	var request struct {
		RuntimeVersion string `json:"runtime_version"`
		Platform       string `json:"platform"`
		Mode           string `json:"mode"`
		GroupID        string `json:"group_id"`
	}
	if json.NewDecoder(r.Body).Decode(&request) != nil || request.RuntimeVersion == "" || request.Platform == "" || request.Mode == "" {
		http.Error(w, "runtime_version, platform, mode required", http.StatusBadRequest)
		return
	}
	var groupID *uuid.UUID
	if request.Mode == "ota" {
		id, err := uuid.Parse(request.GroupID)
		if err != nil {
			http.Error(w, "group_id", http.StatusBadRequest)
			return
		}
		groupID = &id
		compatible, err := s.DB.Queries.IsCompatibleUpdateGroup(r.Context(), db.IsCompatibleUpdateGroupParams{ID: pgUUID(groupID), Channel: chi.URLParam(r, "channel"), RuntimeVersion: request.RuntimeVersion, Platform: request.Platform})
		if err != nil || !compatible {
			http.Error(w, "incompatible update group", http.StatusBadRequest)
			return
		}
	}
	channel := chi.URLParam(r, "channel")
	err := s.DB.Queries.UpsertChannelHead(r.Context(), db.UpsertChannelHeadParams{Channel: channel, RuntimeVersion: request.RuntimeVersion, Platform: request.Platform, GroupID: pgUUID(groupID), Mode: request.Mode})
	if err != nil {
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	_ = s.DB.Queries.InsertChannelHistory(r.Context(), db.InsertChannelHistoryParams{Channel: channel, RuntimeVersion: request.RuntimeVersion, Platform: request.Platform, GroupID: pgUUID(groupID), Mode: request.Mode, Action: "rollback", Actor: pgtype.Text{String: "admin", Valid: true}})
	writeJSON(w, http.StatusOK, map[string]string{"status": "rolled back"})
}

func (s *Server) channels(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Queries.ListChannelHeads(r.Context())
	if err != nil {
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	out := make([]any, 0, len(rows))
	for _, row := range rows {
		out = append(out, map[string]any{"channel": row.Channel, "runtime_version": row.RuntimeVersion, "platform": row.Platform, "group_id": uuid.UUID(row.GroupID.Bytes), "mode": row.Mode, "updated_at": row.UpdatedAt.Time})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) channel(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Queries.ListChannelHeadsByChannel(r.Context(), chi.URLParam(r, "channel"))
	if err != nil {
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	out := make([]any, 0, len(rows))
	for _, row := range rows {
		out = append(out, map[string]any{"runtime_version": row.RuntimeVersion, "platform": row.Platform, "group_id": uuid.UUID(row.GroupID.Bytes), "mode": row.Mode, "updated_at": row.UpdatedAt.Time})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) history(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Queries.ListChannelHistory(r.Context(), chi.URLParam(r, "channel"))
	if err != nil {
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	out := make([]any, 0, len(rows))
	for _, row := range rows {
		out = append(out, map[string]any{"group_id": uuid.UUID(row.GroupID.Bytes), "mode": row.Mode, "action": row.Action, "created_at": row.CreatedAt.Time})
	}
	writeJSON(w, http.StatusOK, out)
}
