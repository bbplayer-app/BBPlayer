package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	dbq "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type Event struct {
	ID                     uuid.UUID       `json:"event_id"`
	Schema                 int             `json:"schema_version"`
	Type                   ClientEventType `json:"event_type"`
	Occurred               time.Time       `json:"occurred_at"`
	Installation           string          `json:"installation_id"`
	ClientVersion          string          `json:"client_version"`
	ClientBuild            string          `json:"client_build_version"`
	ExpoUpdatesVersion     string          `json:"expo_updates_version"`
	UpdatesProtocolVersion string          `json:"updates_protocol_version"`
	Platform               string          `json:"platform"`
	Runtime                string          `json:"runtime_version"`
	Channel                string          `json:"channel"`
	UpdateID               *uuid.UUID      `json:"launched_update_id"`
	EmbeddedUpdateID       *uuid.UUID      `json:"embedded_update_id"`
	// GroupID is never supplied by clients; the server resolves it from
	// UpdateID and fills it in before persisting the event.
	GroupID      *uuid.UUID     `json:"update_group_id"`
	LaunchSource string         `json:"launch_source"`
	Payload      map[string]any `json:"payload"`
}

func (s *Server) event(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
	if err != nil {
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			http.Error(w, "event too large", http.StatusRequestEntityTooLarge)
			return
		}

		http.Error(w, "failed to read request body", http.StatusBadRequest)
		return
	}
	var fields map[string]json.RawMessage
	var e Event
	mandatory := []string{"schema_version", "event_id", "event_type", "occurred_at", "installation_id", "client_version", "client_build_version", "expo_updates_version", "updates_protocol_version", "platform", "runtime_version", "channel", "launched_update_id", "embedded_update_id", "launch_source"}
	if json.Unmarshal(body, &fields) != nil || json.Unmarshal(body, &e) != nil || e.Schema != 1 || e.ID == uuid.Nil || !e.Type.valid() || e.Occurred.IsZero() || e.Installation == "" || e.ClientVersion == "" || e.ClientBuild == "" || e.ExpoUpdatesVersion == "" || e.UpdatesProtocolVersion == "" || e.Platform == "" || e.Runtime == "" || e.Channel == "" || e.LaunchSource == "" {
		http.Error(w, "invalid event schema v1", 400)
		return
	}
	for _, name := range mandatory {
		if _, ok := fields[name]; !ok {
			http.Error(w, "invalid event schema v1", 400)
			return
		}
	}
	if e.GroupID == nil && e.UpdateID != nil {
		groupID, lookupErr := s.DB.Queries.GetGroupIDForUpdate(r.Context(), pgUUID(e.UpdateID))
		if lookupErr == nil {
			resolved := uuid.UUID(groupID.Bytes)
			e.GroupID = &resolved
		} else if !errors.Is(lookupErr, pgx.ErrNoRows) {
			s.logError(r, "event: resolve update group", lookupErr, "update_id", e.UpdateID.String())
			http.Error(w, "database", http.StatusInternalServerError)
			return
		}
	}
	installationHMAC := installationHMAC(s.C.InstallationHMACKey, e.Installation)
	p, _ := json.Marshal(e.Payload)
	err = s.DB.Queries.InsertClientEvent(
		r.Context(),
		dbq.InsertClientEventParams{
			ID:                     pgUUID(&e.ID),
			SchemaVersion:          int32(e.Schema),
			EventType:              string(e.Type),
			OccurredAt:             pgtype.Timestamptz{Time: e.Occurred, Valid: true},
			InstallationHmac:       pgtype.Text{String: installationHMAC, Valid: true},
			ClientVersion:          pgtype.Text{String: e.ClientVersion, Valid: true},
			ClientBuildVersion:     pgtype.Text{String: e.ClientBuild, Valid: true},
			ExpoUpdatesVersion:     pgtype.Text{String: e.ExpoUpdatesVersion, Valid: true},
			UpdatesProtocolVersion: pgtype.Text{String: e.UpdatesProtocolVersion, Valid: true},
			Platform:               pgtype.Text{String: e.Platform, Valid: true},
			RuntimeVersion:         pgtype.Text{String: e.Runtime, Valid: true},
			Channel:                pgtype.Text{String: e.Channel, Valid: true},
			UpdateID:               pgUUID(e.UpdateID),
			EmbeddedUpdateID:       pgUUID(e.EmbeddedUpdateID),
			GroupID:                pgUUID(e.GroupID),
			LaunchSource:           pgtype.Text{String: e.LaunchSource, Valid: true},
			Payload:                p,
		},
	)
	if err != nil {
		s.logError(r, "event: insert client event", err, "event_id", e.ID.String(), "event_type", e.Type)
		http.Error(w, "database", 500)
		return
	}
	if err := s.recordClientInsights(r.Context(), e, installationHMAC); err != nil {
		s.logError(r, "event: record client insights", err, "event_id", e.ID.String(), "event_type", e.Type)
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) recordClientInsights(ctx context.Context, e Event, installationHMAC string) error {
	if e.UpdateID == nil {
		return nil
	}
	seenAt := e.Occurred.UTC()
	if err := s.DB.Queries.RecordInstallationActivity(ctx, dbq.RecordInstallationActivityParams{
		Day:                pgtype.Date{Time: seenAt, Valid: true},
		InstallationHmac:   installationHMAC,
		Channel:            e.Channel,
		RuntimeVersion:     e.Runtime,
		Platform:           e.Platform,
		ClientVersion:      e.ClientVersion,
		ClientBuildVersion: e.ClientBuild,
		UpdateID:           pgUUID(e.UpdateID),
		GroupID:            pgUUID(e.GroupID),
		FirstSeenAt:        pgtype.Timestamptz{Time: seenAt, Valid: true},
	}); err != nil {
		return err
	}
	params := dbq.RecordKnownLaunchParams{InstallationHmac: installationHMAC, UpdateID: pgUUID(e.UpdateID), GroupID: pgUUID(e.GroupID), Channel: e.Channel, RuntimeVersion: e.Runtime, Platform: e.Platform, ConfirmedAt: pgtype.Timestamptz{Time: seenAt, Valid: true}}
	switch e.Type {
	case EventTypeLaunchSucceeded:
		return s.DB.Queries.RecordKnownLaunch(ctx, params)
	case EventTypeLaunchFailed:
		return s.DB.Queries.RecordKnownCrash(ctx, dbq.RecordKnownCrashParams(params))
	default:
		return nil
	}
}

func (s *Server) recordServer(r *http.Request, kind deliveryMetricKind, gid *uuid.UUID) {
	s.recordDeliveryMetric(r.Context(), kind, deliveryMetricServed, gid, r.Header.Get("expo-platform"), r.Header.Get("expo-runtime-version"), r.Header.Get("expo-channel-name"), 0, 0)
}

func (s *Server) recordDeliveryMetric(ctx context.Context, kind deliveryMetricKind, outcome deliveryMetricOutcome, gid *uuid.UUID, platform, runtime, channel string, bytes, targetBytes int64) {
	if gid == nil {
		return
	}
	if err := s.DB.Queries.RecordDeliveryMetric(ctx, dbq.RecordDeliveryMetricParams{Channel: channel, RuntimeVersion: runtime, Platform: platform, GroupID: pgUUID(gid), Kind: string(kind), Outcome: string(outcome), ByteCount: bytes, TargetByteCount: targetBytes}); err != nil {
		s.Log.Error("delivery metric: record", "error", err, "kind", kind, "outcome", outcome, "channel", channel, "runtime_version", runtime, "platform", platform, "group_id", gid.String())
	}
}
