package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// The dashboard endpoints deliberately return display-oriented aggregates. The
// publish and update APIs remain the stable automation API; this surface avoids
// making the browser recreate analytics from raw event records.
type adminDashboardChannelsOutput struct {
	Body []adminDashboardChannel
}
type adminDashboardChannel struct {
	Channel      string    `json:"channel"`
	UpdatedAt    time.Time `json:"updated_at"`
	RuntimeCount int64     `json:"runtime_count"`
}

type adminDashboardChannelInput struct {
	Channel string `path:"channel" minLength:"1"`
}
type adminDashboardRuntime struct {
	RuntimeVersion string     `json:"runtime_version"`
	Version        string     `json:"version"`
	UpdatedAt      time.Time  `json:"updated_at"`
	HeadGroupID    *uuid.UUID `json:"head_group_id,omitempty"`
	Mode           string     `json:"mode"`
	Platforms      []string   `json:"platforms"`
}
type adminDashboardChannelOutput struct {
	Body struct {
		Channel  string                  `json:"channel"`
		Runtimes []adminDashboardRuntime `json:"runtimes"`
	}
}

type adminDashboardActivityInput struct {
	Channel        string    `path:"channel" minLength:"1"`
	RuntimeVersion string    `query:"runtime_version" minLength:"1"`
	Start          time.Time `query:"start" format:"date-time"`
	End            time.Time `query:"end" format:"date-time"`
}
type adminDashboardActivityPoint struct {
	Day                 time.Time  `json:"day"`
	GroupID             *uuid.UUID `json:"group_id,omitempty"`
	ActiveInstallations int64      `json:"active_installations"`
}
type adminDashboardActivityOutput struct {
	Body struct {
		Start  time.Time                     `json:"start"`
		End    time.Time                     `json:"end"`
		Series []adminDashboardActivityPoint `json:"series"`
	}
}

type adminDashboardUpdateInput struct {
	ID uuid.UUID `path:"id"`
}
type adminDashboardPlatformUpdate struct {
	ID             uuid.UUID `json:"id"`
	Platform       string    `json:"platform"`
	LaunchKey      string    `json:"launch_key"`
	LaunchHash     string    `json:"launch_hash"`
	LaunchSize     int64     `json:"launch_size"`
	FullDownloads  int64     `json:"full_downloads"`
	PatchDownloads int64     `json:"patch_downloads"`
	KnownLaunches  int64     `json:"known_launches"`
	KnownCrashes   int64     `json:"known_crashes"`
}
type adminDashboardUpdateOutput struct {
	Body struct {
		ID                 uuid.UUID                      `json:"id"`
		Channel            string                         `json:"channel"`
		RuntimeVersion     string                         `json:"runtime_version"`
		AppVersion         string                         `json:"app_version"`
		Message            string                         `json:"message"`
		CreatedAt          time.Time                      `json:"created_at"`
		Source             json.RawMessage                `json:"source"`
		FingerprintHash    *string                        `json:"fingerprint_hash,omitempty"`
		FingerprintSources json.RawMessage                `json:"fingerprint_sources"`
		Platforms          []adminDashboardPlatformUpdate `json:"platforms"`
	}
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

type adminDashboardRuntimeSummary struct {
	RuntimeVersion string    `json:"runtime_version"`
	Version        string    `json:"version"`
	UpdatedAt      time.Time `json:"updated_at"`
	UpdateCount    int64     `json:"update_count"`
	Channels       []string  `json:"channels"`
}
type adminDashboardRuntimesOutput struct {
	Body []adminDashboardRuntimeSummary
}
type adminDashboardRuntimeInput struct {
	RuntimeVersion string `path:"runtimeVersion" minLength:"1"`
}
type adminDashboardRuntimeOutput struct {
	Body struct {
		RuntimeVersion string             `json:"runtime_version"`
		Version        string             `json:"version"`
		Channels       []string           `json:"channels"`
		Updates        []adminUpdateGroup `json:"updates"`
	}
}

func registerAdminDashboardRoutes(s *Server, api huma.API) {
	security := []map[string][]string{{adminSecurityScheme: {}}}
	huma.Register(api, huma.Operation{OperationID: "listDashboardChannels", Method: http.MethodGet, Path: "/admin/dashboard/channels", Summary: "List dashboard channels", Tags: []string{"Dashboard"}, Security: security}, s.dashboardChannels)
	huma.Register(api, huma.Operation{OperationID: "getDashboardChannel", Method: http.MethodGet, Path: "/admin/dashboard/channels/{channel}", Summary: "Get dashboard channel runtimes", Tags: []string{"Dashboard"}, Security: security}, s.dashboardChannel)
	huma.Register(api, huma.Operation{OperationID: "getDashboardChannelActivity", Method: http.MethodGet, Path: "/admin/dashboard/channels/{channel}/activity", Summary: "Get channel update activity", Tags: []string{"Dashboard"}, Security: security}, s.dashboardActivity)
	huma.Register(api, huma.Operation{OperationID: "getDashboardUpdate", Method: http.MethodGet, Path: "/admin/dashboard/updates/{id}", Summary: "Get dashboard update detail", Tags: []string{"Dashboard"}, Security: security}, s.dashboardUpdate)
	huma.Register(api, huma.Operation{OperationID: "listDashboardUpdateAssets", Method: http.MethodGet, Path: "/admin/dashboard/updates/{id}/platforms/{platform}/assets", Summary: "List dashboard update assets", Tags: []string{"Dashboard"}, Security: security}, s.dashboardAssets)
	huma.Register(api, huma.Operation{OperationID: "listDashboardRuntimes", Method: http.MethodGet, Path: "/admin/dashboard/runtimes", Summary: "List dashboard runtimes", Tags: []string{"Dashboard"}, Security: security}, s.dashboardRuntimes)
	huma.Register(api, huma.Operation{OperationID: "getDashboardRuntime", Method: http.MethodGet, Path: "/admin/dashboard/runtimes/{runtimeVersion}", Summary: "Get dashboard runtime", Tags: []string{"Dashboard"}, Security: security}, s.dashboardRuntime)
}

func (s *Server) dashboardRuntimes(ctx context.Context, _ *struct{}) (*adminDashboardRuntimesOutput, error) {
	rows, err := s.DB.Queries.ListDashboardRuntimes(ctx)
	if err != nil {
		return nil, s.dbError("dashboard: runtimes", err)
	}
	out := &adminDashboardRuntimesOutput{Body: make([]adminDashboardRuntimeSummary, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminDashboardRuntimeSummary{RuntimeVersion: row.RuntimeVersion, Version: row.Version, UpdatedAt: row.UpdatedAt.Time, UpdateCount: row.UpdateCount, Channels: row.Channels})
	}
	return out, nil
}

func (s *Server) dashboardRuntime(ctx context.Context, input *adminDashboardRuntimeInput) (*adminDashboardRuntimeOutput, error) {
	rows, err := s.DB.Queries.ListDashboardRuntimeUpdates(ctx, input.RuntimeVersion)
	if err != nil {
		return nil, s.dbError("dashboard: runtime updates", err)
	}
	out := &adminDashboardRuntimeOutput{}
	out.Body.RuntimeVersion = input.RuntimeVersion
	out.Body.Channels = []string{}
	out.Body.Updates = []adminUpdateGroup{}
	channelSet := map[string]struct{}{}
	for _, row := range rows {
		item := adminUpdateGroup{ID: uuid.UUID(row.ID.Bytes), Channel: row.Channel, RuntimeVersion: row.RuntimeVersion, AppVersion: row.AppVersion, Message: row.Message, CreatedAt: row.CreatedAt.Time, Source: row.Source}
		if row.FingerprintHash.Valid {
			value := row.FingerprintHash.String
			item.FingerprintHash = &value
		}
		if out.Body.Version == "" {
			out.Body.Version = item.AppVersion
		}
		if _, exists := channelSet[item.Channel]; !exists && item.Channel != "" {
			channelSet[item.Channel] = struct{}{}
			out.Body.Channels = append(out.Body.Channels, item.Channel)
		}
		out.Body.Updates = append(out.Body.Updates, item)
	}
	if len(out.Body.Updates) == 0 {
		return nil, huma.Error404NotFound("runtime not found")
	}
	return out, nil
}

func (s *Server) dashboardChannels(ctx context.Context, _ *struct{}) (*adminDashboardChannelsOutput, error) {
	rows, err := s.DB.Queries.ListDashboardChannels(ctx)
	if err != nil {
		return nil, s.dbError("dashboard: channels", err)
	}
	out := &adminDashboardChannelsOutput{Body: make([]adminDashboardChannel, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminDashboardChannel{Channel: row.Channel, UpdatedAt: row.UpdatedAt.Time, RuntimeCount: row.RuntimeCount})
	}
	return out, nil
}

func (s *Server) dashboardChannel(ctx context.Context, input *adminDashboardChannelInput) (*adminDashboardChannelOutput, error) {
	rows, err := s.DB.Queries.ListDashboardChannelRuntimes(ctx, input.Channel)
	if err != nil {
		return nil, s.dbError("dashboard: channel runtimes", err)
	}
	out := &adminDashboardChannelOutput{}
	out.Body.Channel = input.Channel
	out.Body.Runtimes = []adminDashboardRuntime{}
	for _, row := range rows {
		runtime := adminDashboardRuntime{RuntimeVersion: row.RuntimeVersion, UpdatedAt: row.UpdatedAt.Time, Version: row.Version, Mode: row.Mode, Platforms: row.Platforms}
		if row.HeadGroupID != "" {
			parsed, err := uuid.Parse(row.HeadGroupID)
			if err == nil {
				runtime.HeadGroupID = &parsed
			}
		}
		out.Body.Runtimes = append(out.Body.Runtimes, runtime)
	}
	return out, nil
}

func (s *Server) dashboardActivity(ctx context.Context, input *adminDashboardActivityInput) (*adminDashboardActivityOutput, error) {
	start, end, err := metricRangeValues(input.Start, input.End)
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.Queries.ListDashboardActivity(ctx, db.ListDashboardActivityParams{Day: pgtype.Date{Time: start, Valid: true}, Day_2: pgtype.Date{Time: end.AddDate(0, 0, 1), Valid: true}, Channel: input.Channel, RuntimeVersion: input.RuntimeVersion})
	if err != nil {
		return nil, s.dbError("dashboard: activity", err)
	}
	out := &adminDashboardActivityOutput{}
	out.Body.Start, out.Body.End, out.Body.Series = start, end, []adminDashboardActivityPoint{}
	for _, row := range rows {
		point := adminDashboardActivityPoint{Day: row.Day.Time, ActiveInstallations: row.ActiveInstallations}
		if row.GroupID != "" {
			parsed, err := uuid.Parse(row.GroupID)
			if err == nil {
				point.GroupID = &parsed
			}
		}
		out.Body.Series = append(out.Body.Series, point)
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
	rows, err := s.DB.Queries.ListDashboardUpdatePlatforms(ctx, pgtype.UUID{Bytes: [16]byte(input.ID), Valid: true})
	if err != nil {
		return nil, s.dbError("dashboard: update platforms", err)
	}
	for _, row := range rows {
		out.Body.Platforms = append(out.Body.Platforms, adminDashboardPlatformUpdate{ID: uuid.UUID(row.ID.Bytes), Platform: row.Platform, LaunchKey: row.LaunchKey, LaunchHash: row.LaunchHash, LaunchSize: row.SizeBytes, FullDownloads: row.FullDownloads, PatchDownloads: row.PatchDownloads, KnownLaunches: row.KnownLaunches, KnownCrashes: row.KnownCrashes})
	}
	return out, nil
}

func (s *Server) dashboardAssets(ctx context.Context, input *adminDashboardAssetsInput) (*adminDashboardAssetsOutput, error) {
	rows, err := s.DB.Queries.ListDashboardUpdateAssets(ctx, db.ListDashboardUpdateAssetsParams{GroupID: pgtype.UUID{Bytes: [16]byte(input.ID), Valid: true}, Platform: input.Platform})
	if err != nil {
		return nil, s.dbError("dashboard: assets", err)
	}
	out := &adminDashboardAssetsOutput{Body: make([]adminDashboardAsset, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminDashboardAsset{ID: row.ID, AssetKey: row.AssetKey, ContentType: row.ContentType, SizeBytes: row.SizeBytes, IsLaunch: row.IsLaunch})
	}
	return out, nil
}
