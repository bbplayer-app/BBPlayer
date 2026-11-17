package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// The dashboard endpoints deliberately return display-oriented aggregates. The
// publish and update APIs remain the stable automation API; this surface avoids
// making the browser recreate analytics from raw event records.

type adminDashboardFleetRow struct {
	Channel        string `json:"channel"`
	RuntimeVersion string `json:"runtime_version"`
	Platform       string `json:"platform"`
	AppVersion     string `json:"app_version"`
	// ActiveUsers counts installations active on this channel/runtime/platform in the last 7 days.
	ActiveUsers int64 `json:"active_users"`
	// HeadMode is "ota", "embedded", or empty when the channel never targeted this runtime.
	HeadMode      string     `json:"head_mode"`
	HeadGroupID   *uuid.UUID `json:"head_group_id,omitempty"`
	HeadUpdatedAt *time.Time `json:"head_updated_at,omitempty"`
	HeadMessage   string     `json:"head_message"`
	HeadCreatedAt *time.Time `json:"head_created_at,omitempty"`
	HeadCommitSHA string     `json:"head_commit_sha"`
	// HeadUsers counts installations that ran the head update in the last 7 days.
	HeadUsers    int64 `json:"head_users"`
	HeadLaunches int64 `json:"head_launches"`
	HeadCrashes  int64 `json:"head_crashes"`
}

type adminDashboardHistoryEntry struct {
	ID             int64      `json:"id"`
	Channel        string     `json:"channel"`
	RuntimeVersion string     `json:"runtime_version"`
	Platform       string     `json:"platform"`
	GroupID        *uuid.UUID `json:"group_id,omitempty"`
	Mode           string     `json:"mode"`
	Action         string     `json:"action"`
	CreatedAt      time.Time  `json:"created_at"`
	Message        string     `json:"message"`
	CommitSHA      string     `json:"commit_sha"`
	AppVersion     string     `json:"app_version"`
}

type adminDashboardOverviewOutput struct {
	Body struct {
		Fleet   []adminDashboardFleetRow     `json:"fleet"`
		History []adminDashboardHistoryEntry `json:"history"`
		Patches struct {
			Failed  int64 `json:"failed"`
			Pending int64 `json:"pending"`
		} `json:"patches"`
	}
}

type adminDashboardHistoryInput struct {
	Channel string `query:"channel"`
	Limit   int32  `query:"limit" default:"50" minimum:"1" maximum:"500"`
}
type adminDashboardHistoryOutput struct {
	Body []adminDashboardHistoryEntry
}

type adminDashboardRelease struct {
	ID                     uuid.UUID  `json:"id"`
	Channel                string     `json:"channel"`
	RuntimeVersion         string     `json:"runtime_version"`
	AppVersion             string     `json:"app_version"`
	Message                string     `json:"message"`
	CreatedAt              time.Time  `json:"created_at"`
	CommitSHA              string     `json:"commit_sha"`
	RepublishedFromGroupID *uuid.UUID `json:"republished_from_group_id,omitempty"`
	Platforms              []string   `json:"platforms"`
	LivePlatforms          []string   `json:"live_platforms"`
	Launches               int64      `json:"launches"`
	Crashes                int64      `json:"crashes"`
	ActiveUsers            int64      `json:"active_users"`
	Downloads              int64      `json:"downloads"`
}
type adminDashboardReleasesOutput struct {
	Body []adminDashboardRelease
}

type adminDashboardUpdateInput struct {
	ID uuid.UUID `path:"id"`
}
type adminDashboardPlatformUpdate struct {
	ID               uuid.UUID             `json:"id"`
	Platform         string                `json:"platform"`
	LaunchKey        string                `json:"launch_key"`
	LaunchHash       string                `json:"launch_hash"`
	LaunchSize       int64                 `json:"launch_size"`
	FullDownloads    int64                 `json:"full_downloads"`
	PatchDownloads   int64                 `json:"patch_downloads"`
	PatchBytes       int64                 `json:"patch_bytes"`
	PatchTargetBytes int64                 `json:"patch_target_bytes"`
	KnownLaunches    int64                 `json:"known_launches"`
	KnownCrashes     int64                 `json:"known_crashes"`
	IsLive           bool                  `json:"is_live"`
	Patches          []adminDashboardPatch `json:"patches"`
}
type adminDashboardPatch struct {
	ID           int64     `json:"id"`
	FromUpdateID uuid.UUID `json:"from_update_id"`
	FromGroupID  uuid.UUID `json:"from_group_id"`
	FromMessage  string    `json:"from_message"`
	Status       string    `json:"status"`
	SizeBytes    *int64    `json:"size_bytes,omitempty"`
	Attempts     int32     `json:"attempts"`
	ServedCount  int64     `json:"served_count"`
	Error        *string   `json:"error,omitempty"`
	UpdatedAt    time.Time `json:"updated_at"`
}
type adminDashboardReleaseRef struct {
	ID        uuid.UUID `json:"id"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
	CommitSHA string    `json:"commit_sha"`
}
type adminDashboardUpdateOutput struct {
	Body struct {
		ID                      uuid.UUID                      `json:"id"`
		Channel                 string                         `json:"channel"`
		RuntimeVersion          string                         `json:"runtime_version"`
		AppVersion              string                         `json:"app_version"`
		Message                 string                         `json:"message"`
		CreatedAt               time.Time                      `json:"created_at"`
		Source                  json.RawMessage                `json:"source"`
		FingerprintHash         *string                        `json:"fingerprint_hash,omitempty"`
		RepublishedFromUpdateID *uuid.UUID                     `json:"republished_from_update_id,omitempty"`
		RepublishedFromGroupID  *uuid.UUID                     `json:"republished_from_group_id,omitempty"`
		FingerprintSources      json.RawMessage                `json:"fingerprint_sources"`
		Previous                *adminDashboardReleaseRef      `json:"previous,omitempty"`
		Platforms               []adminDashboardPlatformUpdate `json:"platforms"`
	}
}

type adminDashboardAdoptionInput struct {
	ID   uuid.UUID `path:"id"`
	Days int       `query:"days" default:"30" minimum:"1" maximum:"365"`
}
type adminDashboardAdoptionPoint struct {
	Day          string `json:"day"`
	ReleaseUsers int64  `json:"release_users"`
	RuntimeUsers int64  `json:"runtime_users"`
}
type adminDashboardAdoptionOutput struct {
	Body []adminDashboardAdoptionPoint
}

type adminDashboardAssetsInput struct {
	ID       uuid.UUID `path:"id"`
	Platform string    `path:"platform" enum:"android,ios"`
}
type adminDashboardAsset struct {
	ID          int64  `json:"id"`
	AssetKey    string `json:"asset_key"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	IsLaunch    bool   `json:"is_launch"`
}
type adminDashboardAssetsOutput struct{ Body []adminDashboardAsset }

func registerAdminDashboardRoutes(s *Server, api huma.API) {
	security := []map[string][]string{{adminSecurityScheme: {}}}
	huma.Register(api, huma.Operation{OperationID: "getDashboardOverview", Method: http.MethodGet, Path: "/admin/dashboard/overview", Summary: "Get fleet, recent channel history and patch attention", Tags: []string{"Dashboard"}, Security: security}, s.dashboardOverview)
	huma.Register(api, huma.Operation{OperationID: "listDashboardHistory", Method: http.MethodGet, Path: "/admin/dashboard/history", Summary: "List channel head changes", Tags: []string{"Dashboard"}, Security: security}, s.dashboardHistory)
	huma.Register(api, huma.Operation{OperationID: "listDashboardReleases", Method: http.MethodGet, Path: "/admin/dashboard/releases", Summary: "List releases with live status and health", Tags: []string{"Dashboard"}, Security: security}, s.dashboardReleases)
	huma.Register(api, huma.Operation{OperationID: "getDashboardUpdate", Method: http.MethodGet, Path: "/admin/dashboard/updates/{id}", Summary: "Get dashboard update detail", Tags: []string{"Dashboard"}, Security: security}, s.dashboardUpdate)
	huma.Register(api, huma.Operation{OperationID: "getDashboardUpdateAdoption", Method: http.MethodGet, Path: "/admin/dashboard/updates/{id}/adoption", Summary: "Get daily adoption of an update group", Tags: []string{"Dashboard"}, Security: security}, s.dashboardAdoption)
	huma.Register(api, huma.Operation{OperationID: "listDashboardUpdateAssets", Method: http.MethodGet, Path: "/admin/dashboard/updates/{id}/platforms/{platform}/assets", Summary: "List dashboard update assets", Tags: []string{"Dashboard"}, Security: security}, s.dashboardAssets)
}

func optionalUUID(value pgtype.UUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	id := uuid.UUID(value.Bytes)
	return &id
}

func optionalTime(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}

func historyEntries(rows []db.ListDashboardHistoryRow) []adminDashboardHistoryEntry {
	out := make([]adminDashboardHistoryEntry, 0, len(rows))
	for _, row := range rows {
		out = append(out, adminDashboardHistoryEntry{ID: row.ID, Channel: row.Channel, RuntimeVersion: row.RuntimeVersion, Platform: row.Platform, GroupID: optionalUUID(row.GroupID), Mode: row.Mode, Action: row.Action, CreatedAt: row.CreatedAt.Time, Message: row.Message, CommitSHA: row.CommitSha, AppVersion: row.AppVersion})
	}
	return out
}

func (s *Server) dashboardOverview(ctx context.Context, _ *struct{}) (*adminDashboardOverviewOutput, error) {
	fleet, err := s.DB.Queries.ListDashboardFleet(ctx)
	if err != nil {
		return nil, s.dbError("dashboard: fleet", err)
	}
	out := &adminDashboardOverviewOutput{}
	out.Body.Fleet = make([]adminDashboardFleetRow, 0, len(fleet))
	for _, row := range fleet {
		out.Body.Fleet = append(out.Body.Fleet, adminDashboardFleetRow{Channel: row.Channel, RuntimeVersion: row.RuntimeVersion, Platform: row.Platform, AppVersion: row.AppVersion, ActiveUsers: row.ActiveUsers, HeadMode: row.HeadMode, HeadGroupID: optionalUUID(row.HeadGroupID), HeadUpdatedAt: optionalTime(row.HeadUpdatedAt), HeadMessage: row.HeadMessage, HeadCreatedAt: optionalTime(row.HeadCreatedAt), HeadCommitSHA: row.HeadCommitSha, HeadUsers: row.HeadUsers, HeadLaunches: row.HeadLaunches, HeadCrashes: row.HeadCrashes})
	}
	history, err := s.DB.Queries.ListDashboardHistory(ctx, db.ListDashboardHistoryParams{RowLimit: 8})
	if err != nil {
		return nil, s.dbError("dashboard: history", err)
	}
	out.Body.History = historyEntries(history)
	patches, err := s.DB.Queries.GetDashboardPatchAttention(ctx)
	if err != nil {
		return nil, s.dbError("dashboard: patch attention", err)
	}
	out.Body.Patches.Failed, out.Body.Patches.Pending = patches.Failed, patches.Pending
	return out, nil
}

func (s *Server) dashboardHistory(ctx context.Context, input *adminDashboardHistoryInput) (*adminDashboardHistoryOutput, error) {
	rows, err := s.DB.Queries.ListDashboardHistory(ctx, db.ListDashboardHistoryParams{Channel: pgtype.Text{String: input.Channel, Valid: input.Channel != ""}, RowLimit: input.Limit})
	if err != nil {
		return nil, s.dbError("dashboard: history", err)
	}
	return &adminDashboardHistoryOutput{Body: historyEntries(rows)}, nil
}

func (s *Server) dashboardReleases(ctx context.Context, _ *struct{}) (*adminDashboardReleasesOutput, error) {
	rows, err := s.DB.Queries.ListDashboardReleases(ctx)
	if err != nil {
		return nil, s.dbError("dashboard: releases", err)
	}
	out := &adminDashboardReleasesOutput{Body: make([]adminDashboardRelease, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminDashboardRelease{ID: uuid.UUID(row.ID.Bytes), Channel: row.Channel, RuntimeVersion: row.RuntimeVersion, AppVersion: row.AppVersion, Message: row.Message, CreatedAt: row.CreatedAt.Time, CommitSHA: row.CommitSha, RepublishedFromGroupID: optionalUUID(row.RepublishedFromGroupID), Platforms: row.Platforms, LivePlatforms: row.LivePlatforms, Launches: row.Launches, Crashes: row.Crashes, ActiveUsers: row.ActiveUsers, Downloads: row.Downloads})
	}
	return out, nil
}

func (s *Server) dashboardAdoption(ctx context.Context, input *adminDashboardAdoptionInput) (*adminDashboardAdoptionOutput, error) {
	// Today is still in progress and would read as a drop, so the series ends yesterday.
	end := time.Now().UTC().Truncate(24 * time.Hour)
	rows, err := s.DB.Queries.ListDashboardReleaseAdoption(ctx, db.ListDashboardReleaseAdoptionParams{GroupID: pgUUID(&input.ID), StartDay: pgDate(end.AddDate(0, 0, -input.Days)), EndDay: pgDate(end)})
	if err != nil {
		return nil, s.dbError("dashboard: adoption", err)
	}
	out := &adminDashboardAdoptionOutput{Body: make([]adminDashboardAdoptionPoint, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminDashboardAdoptionPoint{Day: audienceDay(row.Day), ReleaseUsers: row.ReleaseUsers, RuntimeUsers: row.RuntimeUsers})
	}
	return out, nil
}

func (s *Server) dashboardUpdate(ctx context.Context, input *adminDashboardUpdateInput) (*adminDashboardUpdateOutput, error) {
	group, err := s.DB.Queries.GetUpdateGroup(ctx, pgUUID(&input.ID))
	if err != nil {
		return nil, huma.Error404NotFound("update group not found")
	}
	out := &adminDashboardUpdateOutput{}
	out.Body.ID, out.Body.Channel, out.Body.RuntimeVersion, out.Body.Message, out.Body.CreatedAt = input.ID, group.Channel, group.RuntimeVersion, group.Message, group.CreatedAt.Time
	var expoConfig struct {
		Version string `json:"version"`
	}
	_ = json.Unmarshal(group.ExpoConfig, &expoConfig)
	out.Body.AppVersion = expoConfig.Version
	out.Body.Source, out.Body.FingerprintSources = group.Source, group.FingerprintSources
	out.Body.Platforms = []adminDashboardPlatformUpdate{}
	if group.FingerprintHash.Valid {
		value := group.FingerprintHash.String
		out.Body.FingerprintHash = &value
	}
	out.Body.RepublishedFromUpdateID = optionalUUID(group.RepublishedFromUpdateID)
	if group.RepublishedFromUpdateID.Valid {
		original, err := s.DB.Queries.GetGroupIDForUpdate(ctx, group.RepublishedFromUpdateID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, s.dbError("dashboard: republished source", err)
		}
		out.Body.RepublishedFromGroupID = optionalUUID(original)
	}
	previous, err := s.DB.Queries.GetDashboardPreviousRelease(ctx, pgUUID(&input.ID))
	switch {
	case err == nil:
		out.Body.Previous = &adminDashboardReleaseRef{ID: uuid.UUID(previous.ID.Bytes), Message: previous.Message, CreatedAt: previous.CreatedAt.Time, CommitSHA: previous.CommitSha}
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, s.dbError("dashboard: previous release", err)
	}
	rows, err := s.DB.Queries.ListDashboardUpdatePlatforms(ctx, pgUUID(&input.ID))
	if err != nil {
		return nil, s.dbError("dashboard: update platforms", err)
	}
	platformIndex := make(map[uuid.UUID]int, len(rows))
	for _, row := range rows {
		updateID := uuid.UUID(row.ID.Bytes)
		platformIndex[updateID] = len(out.Body.Platforms)
		out.Body.Platforms = append(out.Body.Platforms, adminDashboardPlatformUpdate{ID: updateID, Platform: row.Platform, LaunchKey: row.LaunchKey, LaunchHash: row.LaunchHash, LaunchSize: row.SizeBytes, FullDownloads: row.FullDownloads, PatchDownloads: row.PatchDownloads, PatchBytes: row.PatchBytes, PatchTargetBytes: row.PatchTargetBytes, KnownLaunches: row.KnownLaunches, KnownCrashes: row.KnownCrashes, IsLive: row.IsLive, Patches: []adminDashboardPatch{}})
	}
	patches, err := s.DB.Queries.ListDashboardUpdatePatches(ctx, pgUUID(&input.ID))
	if err != nil {
		return nil, s.dbError("dashboard: update patches", err)
	}
	for _, row := range patches {
		index, exists := platformIndex[uuid.UUID(row.ToUpdateID.Bytes)]
		if !exists {
			continue
		}
		patch := adminDashboardPatch{ID: row.ID, FromUpdateID: uuid.UUID(row.FromUpdateID.Bytes), FromGroupID: uuid.UUID(row.FromGroupID.Bytes), FromMessage: row.FromMessage, Status: row.Status, Attempts: row.Attempts, ServedCount: row.ServedCount, UpdatedAt: row.UpdatedAt.Time}
		if row.SizeBytes.Valid {
			value := row.SizeBytes.Int64
			patch.SizeBytes = &value
		}
		if row.Error.Valid {
			value := row.Error.String
			patch.Error = &value
		}
		out.Body.Platforms[index].Patches = append(out.Body.Platforms[index].Patches, patch)
	}
	return out, nil
}

func (s *Server) dashboardAssets(ctx context.Context, input *adminDashboardAssetsInput) (*adminDashboardAssetsOutput, error) {
	rows, err := s.DB.Queries.ListDashboardUpdateAssets(ctx, db.ListDashboardUpdateAssetsParams{GroupID: pgUUID(&input.ID), Platform: input.Platform})
	if err != nil {
		return nil, s.dbError("dashboard: assets", err)
	}
	out := &adminDashboardAssetsOutput{Body: make([]adminDashboardAsset, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminDashboardAsset{ID: row.ID, AssetKey: row.AssetKey, ContentType: row.ContentType, SizeBytes: row.SizeBytes, IsLaunch: row.IsLaunch})
	}
	return out, nil
}
