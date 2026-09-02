package server

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"time"

	dbq "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Event struct {
	ID                     uuid.UUID      `json:"event_id"`
	Schema                 int            `json:"schema_version"`
	Type                   string         `json:"event_type"`
	Occurred               time.Time      `json:"occurred_at"`
	Installation           string         `json:"installation_id"`
	ClientVersion          string         `json:"client_version"`
	ClientBuild            string         `json:"client_build_version"`
	ExpoUpdatesVersion     string         `json:"expo_updates_version"`
	UpdatesProtocolVersion string         `json:"updates_protocol_version"`
	Platform               string         `json:"platform"`
	Runtime                string         `json:"runtime_version"`
	Channel                string         `json:"channel"`
	UpdateID               *uuid.UUID     `json:"launched_update_id"`
	EmbeddedUpdateID       *uuid.UUID     `json:"embedded_update_id"`
	GroupID                *uuid.UUID     `json:"update_group_id"`
	LaunchSource           string         `json:"launch_source"`
	Payload                map[string]any `json:"payload"`
}

func (s *Server) event(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
	if err != nil {
		http.Error(w, "event too large", http.StatusRequestEntityTooLarge)
		return
	}
	var fields map[string]json.RawMessage
	var e Event
	mandatory := []string{"schema_version", "event_id", "event_type", "occurred_at", "installation_id", "client_version", "client_build_version", "expo_updates_version", "updates_protocol_version", "platform", "runtime_version", "channel", "launched_update_id", "embedded_update_id", "update_group_id", "launch_source"}
	if json.Unmarshal(body, &fields) != nil || json.Unmarshal(body, &e) != nil || e.Schema != 1 || e.ID == uuid.Nil || e.Type == "" || e.Occurred.IsZero() || e.Installation == "" || e.ClientVersion == "" || e.ClientBuild == "" || e.ExpoUpdatesVersion == "" || e.UpdatesProtocolVersion == "" || e.Platform == "" || e.Runtime == "" || e.Channel == "" || e.LaunchSource == "" {
		http.Error(w, "invalid event schema v1", 400)
		return
	}
	for _, name := range mandatory {
		if _, ok := fields[name]; !ok {
			http.Error(w, "invalid event schema v1", 400)
			return
		}
	}
	m := hmac.New(sha256.New, []byte(s.C.InstallationHMACKey))
	_, _ = m.Write([]byte(e.Installation))
	p, _ := json.Marshal(e.Payload)
	err = s.DB.Queries.InsertClientEvent(r.Context(), dbq.InsertClientEventParams{ID: pgUUID(&e.ID), SchemaVersion: int32(e.Schema), EventType: e.Type, OccurredAt: pgtype.Timestamptz{Time: e.Occurred, Valid: true}, InstallationHmac: pgtype.Text{String: base64.RawURLEncoding.EncodeToString(m.Sum(nil)), Valid: true}, ClientVersion: pgtype.Text{String: e.ClientVersion, Valid: true}, ClientBuildVersion: pgtype.Text{String: e.ClientBuild, Valid: true}, ExpoUpdatesVersion: pgtype.Text{String: e.ExpoUpdatesVersion, Valid: true}, UpdatesProtocolVersion: pgtype.Text{String: e.UpdatesProtocolVersion, Valid: true}, Platform: pgtype.Text{String: e.Platform, Valid: true}, RuntimeVersion: pgtype.Text{String: e.Runtime, Valid: true}, Channel: pgtype.Text{String: e.Channel, Valid: true}, UpdateID: pgUUID(e.UpdateID), EmbeddedUpdateID: pgUUID(e.EmbeddedUpdateID), GroupID: pgUUID(e.GroupID), LaunchSource: pgtype.Text{String: e.LaunchSource, Valid: true}, Payload: p})
	if err != nil {
		http.Error(w, "database", 500)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) recordServer(r *http.Request, typ string, gid *uuid.UUID) {
	s.recordServerPayload(r, typ, gid, map[string]any{})
}
func (s *Server) recordServerPayload(r *http.Request, typ string, gid *uuid.UUID, payload map[string]any) {
	s.recordServerPayloadContext(r.Context(), typ, gid, r.Header.Get("expo-platform"), r.Header.Get("expo-runtime-version"), r.Header.Get("expo-channel-name"), payload)
}
func (s *Server) recordServerPayloadContext(ctx context.Context, typ string, gid *uuid.UUID, platform, runtime, channel string, payload map[string]any) {
	p, err := json.Marshal(payload)
	if err != nil {
		return
	}
	_ = s.DB.Queries.InsertServerEvent(ctx, dbq.InsertServerEventParams{EventType: typ, Platform: pgtype.Text{String: platform, Valid: true}, RuntimeVersion: pgtype.Text{String: runtime, Valid: true}, Channel: pgtype.Text{String: channel, Valid: true}, GroupID: pgUUID(gid), Payload: p})
}
