package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
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
	ID            uuid.UUID `json:"id"`
	Platform      string    `json:"platform"`
	LaunchKey     string    `json:"launch_key"`
	LaunchHash    string    `json:"launch_hash"`
	LaunchSize    int64     `json:"launch_size"`
	Downloads     int64     `json:"downloads"`
	KnownLaunches int64     `json:"known_launches"`
	KnownCrashes  int64     `json:"known_crashes"`
}
type adminDashboardUpdateOutput struct {
	Body struct {
		ID                 uuid.UUID                      `json:"id"`
		Channel            string                         `json:"channel"`
		RuntimeVersion     string                         `json:"runtime_version"`
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
	Downloads   int64  `json:"downloads"`
}
type adminDashboardAssetsOutput struct{ Body []adminDashboardAsset }

func registerAdminDashboardRoutes(s *Server, api huma.API) {
	security := []map[string][]string{{adminSecurityScheme: {}}}
	huma.Register(api, huma.Operation{OperationID: "listDashboardChannels", Method: http.MethodGet, Path: "/admin/dashboard/channels", Summary: "List dashboard channels", Tags: []string{"Dashboard"}, Security: security}, s.dashboardChannels)
	huma.Register(api, huma.Operation{OperationID: "getDashboardChannel", Method: http.MethodGet, Path: "/admin/dashboard/channels/{channel}", Summary: "Get dashboard channel runtimes", Tags: []string{"Dashboard"}, Security: security}, s.dashboardChannel)
	huma.Register(api, huma.Operation{OperationID: "getDashboardChannelActivity", Method: http.MethodGet, Path: "/admin/dashboard/channels/{channel}/activity", Summary: "Get channel update activity", Tags: []string{"Dashboard"}, Security: security}, s.dashboardActivity)
	huma.Register(api, huma.Operation{OperationID: "getDashboardUpdate", Method: http.MethodGet, Path: "/admin/dashboard/updates/{id}", Summary: "Get dashboard update detail", Tags: []string{"Dashboard"}, Security: security}, s.dashboardUpdate)
	huma.Register(api, huma.Operation{OperationID: "listDashboardUpdateAssets", Method: http.MethodGet, Path: "/admin/dashboard/updates/{id}/platforms/{platform}/assets", Summary: "List dashboard update assets", Tags: []string{"Dashboard"}, Security: security}, s.dashboardAssets)
}

func (s *Server) dashboardChannels(ctx context.Context, _ *struct{}) (*adminDashboardChannelsOutput, error) {
	rows, err := s.DB.Pool.Query(ctx, `SELECT channel, max(updated_at), count(DISTINCT runtime_version) FROM channel_heads GROUP BY channel ORDER BY channel`)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	defer rows.Close()
	out := &adminDashboardChannelsOutput{Body: []adminDashboardChannel{}}
	for rows.Next() {
		var row adminDashboardChannel
		if err := rows.Scan(&row.Channel, &row.UpdatedAt, &row.RuntimeCount); err != nil {
			return nil, huma.Error500InternalServerError("database")
		}
		out.Body = append(out.Body, row)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	return out, nil
}

func (s *Server) dashboardChannel(ctx context.Context, input *adminDashboardChannelInput) (*adminDashboardChannelOutput, error) {
	rows, err := s.DB.Pool.Query(ctx, `SELECT runtime_version, max(updated_at), (array_agg(group_id ORDER BY updated_at DESC))[1]::text, (array_agg(mode ORDER BY updated_at DESC))[1], array_agg(platform ORDER BY platform) FROM channel_heads WHERE channel=$1 GROUP BY runtime_version ORDER BY max(updated_at) DESC`, input.Channel)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	defer rows.Close()
	out := &adminDashboardChannelOutput{}
	out.Body.Channel = input.Channel
	out.Body.Runtimes = []adminDashboardRuntime{}
	for rows.Next() {
		var row adminDashboardRuntime
		var id *string
		if err := rows.Scan(&row.RuntimeVersion, &row.UpdatedAt, &id, &row.Mode, &row.Platforms); err != nil {
			return nil, huma.Error500InternalServerError("database")
		}
		if id != nil {
			parsed, err := uuid.Parse(*id)
			if err == nil {
				row.HeadGroupID = &parsed
			}
		}
		out.Body.Runtimes = append(out.Body.Runtimes, row)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	return out, nil
}

func (s *Server) dashboardActivity(ctx context.Context, input *adminDashboardActivityInput) (*adminDashboardActivityOutput, error) {
	start, end, err := metricRangeValues(input.Start, input.End)
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.Pool.Query(ctx, `SELECT day, group_id::text, count(DISTINCT installation_hmac)::bigint FROM installation_activity_days WHERE day >= $1 AND day < $2 AND channel=$3 AND runtime_version=$4 GROUP BY day, group_id ORDER BY day, group_id`, start, end.AddDate(0, 0, 1), input.Channel, input.RuntimeVersion)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	defer rows.Close()
	out := &adminDashboardActivityOutput{}
	out.Body.Start, out.Body.End, out.Body.Series = start, end, []adminDashboardActivityPoint{}
	for rows.Next() {
		var row adminDashboardActivityPoint
		var id *string
		if err := rows.Scan(&row.Day, &id, &row.ActiveInstallations); err != nil {
			return nil, huma.Error500InternalServerError("database")
		}
		if id != nil {
			parsed, err := uuid.Parse(*id)
			if err == nil {
				row.GroupID = &parsed
			}
		}
		out.Body.Series = append(out.Body.Series, row)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("database")
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
	out.Body.Source, out.Body.FingerprintSources = group.Source, group.FingerprintSources
	out.Body.Platforms = []adminDashboardPlatformUpdate{}
	if group.FingerprintHash.Valid {
		value := group.FingerprintHash.String
		out.Body.FingerprintHash = &value
	}
	rows, err := s.DB.Pool.Query(ctx, `SELECT u.id,u.platform,u.launch_key,u.launch_hash,a.size_bytes,(SELECT count(*) FROM update_events e WHERE e.group_id=u.group_id AND e.platform=u.platform AND e.event_type='download_succeeded'),(SELECT count(*) FROM known_update_launches l WHERE l.group_id=u.group_id AND l.platform=u.platform),(SELECT count(*) FROM known_update_crashes c WHERE c.group_id=u.group_id AND c.platform=u.platform) FROM updates u JOIN assets a ON a.update_id=u.id AND a.is_launch WHERE u.group_id=$1 ORDER BY u.platform`, input.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	defer rows.Close()
	for rows.Next() {
		var row adminDashboardPlatformUpdate
		if err := rows.Scan(&row.ID, &row.Platform, &row.LaunchKey, &row.LaunchHash, &row.LaunchSize, &row.Downloads, &row.KnownLaunches, &row.KnownCrashes); err != nil {
			return nil, huma.Error500InternalServerError("database")
		}
		out.Body.Platforms = append(out.Body.Platforms, row)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	return out, nil
}

func (s *Server) dashboardAssets(ctx context.Context, input *adminDashboardAssetsInput) (*adminDashboardAssetsOutput, error) {
	rows, err := s.DB.Pool.Query(ctx, `SELECT a.id,a.asset_key,a.content_type,a.size_bytes,a.is_launch,COALESCE((SELECT count(*) FROM update_events e WHERE e.update_id=u.id AND e.event_type='download_succeeded'),0) FROM updates u JOIN assets a ON a.update_id=u.id WHERE u.group_id=$1 AND u.platform=$2 ORDER BY a.is_launch DESC,a.size_bytes DESC`, input.ID, input.Platform)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	defer rows.Close()
	out := &adminDashboardAssetsOutput{Body: []adminDashboardAsset{}}
	for rows.Next() {
		var row adminDashboardAsset
		if err := rows.Scan(&row.ID, &row.AssetKey, &row.ContentType, &row.SizeBytes, &row.IsLaunch, &row.Downloads); err != nil {
			return nil, huma.Error500InternalServerError("database")
		}
		out.Body = append(out.Body, row)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	return out, nil
}
