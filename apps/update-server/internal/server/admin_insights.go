package server

import (
	"context"
	"net/http"
	"time"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type adminActivityInput struct {
	Start    time.Time `query:"start" format:"date-time"`
	End      time.Time `query:"end" format:"date-time"`
	Channel  string    `query:"channel"`
	Platform string    `query:"platform"`
}
type adminActivePoint struct {
	Day                 time.Time `json:"day"`
	ActiveInstallations int64     `json:"active_installations"`
}
type adminVersionPoint struct {
	Day                 time.Time `json:"day"`
	ClientVersion       string    `json:"client_version"`
	ClientBuildVersion  string    `json:"client_build_version"`
	ActiveInstallations int64     `json:"active_installations"`
}
type adminActivityOutput struct {
	Body struct {
		Start               time.Time           `json:"start"`
		End                 time.Time           `json:"end"`
		ActiveInstallations []adminActivePoint  `json:"active_installations"`
		Versions            []adminVersionPoint `json:"versions"`
	}
}
type adminLifecycleInput struct {
	GroupID uuid.UUID `path:"groupID"`
	Start   time.Time `query:"start" format:"date-time"`
	End     time.Time `query:"end" format:"date-time"`
}
type adminLifecyclePoint struct {
	Day           time.Time `json:"day"`
	KnownLaunches int64     `json:"known_launches"`
	KnownCrashes  int64     `json:"known_crashes"`
}
type adminLifecycleOutput struct {
	Body struct {
		Start  time.Time             `json:"start"`
		End    time.Time             `json:"end"`
		Series []adminLifecyclePoint `json:"series"`
	}
}
type adminInsightsInput struct {
	Channel        string `query:"channel"`
	RuntimeVersion string `query:"runtime_version"`
	Platform       string `query:"platform"`
	GroupID        string `query:"group_id" format:"uuid"`
}
type adminInsightEvent struct {
	EventType           string `json:"event_type"`
	Events              int64  `json:"events"`
	UniqueInstallations int64  `json:"unique_installations"`
}
type adminInsightsOutput struct {
	Body struct {
		Events  []adminInsightEvent `json:"events"`
		Summary struct {
			UniqueUsers       int64   `json:"unique_users"`
			UpdateChecks      int64   `json:"update_checks"`
			Downloads         int64   `json:"downloads"`
			Launches          int64   `json:"launches"`
			LaunchSuccesses   int64   `json:"launch_successes"`
			LaunchFailures    int64   `json:"launch_failures"`
			EmergencyLaunches int64   `json:"emergency_launches"`
			LaunchFailureRate float64 `json:"launch_failure_rate"`
		} `json:"summary"`
		Transport struct {
			FullRequests      int64   `json:"full_requests"`
			FullBytes         int64   `json:"full_bytes"`
			BsdiffRequests    int64   `json:"bsdiff_requests"`
			BsdiffBytes       int64   `json:"bsdiff_bytes"`
			BsdiffTargetBytes int64   `json:"bsdiff_target_bytes"`
			BsdiffSavedBytes  int64   `json:"bsdiff_saved_bytes"`
			BsdiffFallbacks   int64   `json:"bsdiff_fallbacks"`
			BsdiffHitRate     float64 `json:"bsdiff_hit_rate"`
		} `json:"transport"`
	}
}

func registerAdminInsightRoutes(s *Server, api huma.API) {
	security := []map[string][]string{{adminSecurityScheme: {}}}
	huma.Register(api, huma.Operation{OperationID: "getActivitySeries", Method: http.MethodGet, Path: "/admin/insights/activity", Summary: "Get activity series", Tags: []string{"Insights"}, Security: security}, s.activity)
	huma.Register(api, huma.Operation{OperationID: "getUpdateGroupLifecycle", Method: http.MethodGet, Path: "/admin/insights/groups/{groupID}/lifecycle", Summary: "Get update group lifecycle", Tags: []string{"Insights"}, Security: security}, s.lifecycle)
}
func registerAdminInsightsSummaryRoute(s *Server, api huma.API) {
	huma.Register(api, huma.Operation{OperationID: "getInsights", Method: http.MethodGet, Path: "/admin/insights", Summary: "Get update insights", Tags: []string{"Insights"}, Security: []map[string][]string{{adminSecurityScheme: {}}}}, s.insights)
}

func (s *Server) insights(ctx context.Context, input *adminInsightsInput) (*adminInsightsOutput, error) {
	filters := db.ListEventInsightsParams{Channel: pgtype.Text{String: input.Channel, Valid: input.Channel != ""}, RuntimeVersion: pgtype.Text{String: input.RuntimeVersion, Valid: input.RuntimeVersion != ""}, Platform: pgtype.Text{String: input.Platform, Valid: input.Platform != ""}}
	if input.GroupID != "" {
		id, parseErr := uuid.Parse(input.GroupID)
		if parseErr != nil {
			return nil, huma.Error400BadRequest("group_id")
		}
		filters.GroupID = pgUUID(&id)
	}
	rows, err := s.DB.Queries.ListEventInsights(ctx, filters)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	summary, err := s.DB.Queries.GetEventInsightSummary(ctx, db.GetEventInsightSummaryParams(filters))
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	transport, err := s.DB.Queries.GetTransportInsightSummary(ctx, db.GetTransportInsightSummaryParams(filters))
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	out := &adminInsightsOutput{}
	out.Body.Events = make([]adminInsightEvent, 0, len(rows))
	for _, row := range rows {
		out.Body.Events = append(out.Body.Events, adminInsightEvent{ClientEventType: row.EventType, Events: row.EventCount, UniqueInstallations: row.UniqueInstallations})
	}
	out.Body.Summary.UniqueUsers, out.Body.Summary.UpdateChecks, out.Body.Summary.Downloads, out.Body.Summary.Launches, out.Body.Summary.LaunchSuccesses, out.Body.Summary.LaunchFailures, out.Body.Summary.EmergencyLaunches = summary.UniqueInstallations, summary.UpdateChecks, summary.Downloads, summary.Launches, summary.LaunchSuccesses, summary.LaunchFailures, summary.EmergencyLaunches
	if summary.Launches > 0 {
		out.Body.Summary.LaunchFailureRate = float64(summary.LaunchFailures) / float64(summary.Launches)
	}
	out.Body.Transport.FullRequests, out.Body.Transport.FullBytes, out.Body.Transport.BsdiffRequests, out.Body.Transport.BsdiffBytes, out.Body.Transport.BsdiffTargetBytes, out.Body.Transport.BsdiffFallbacks = transport.FullRequests, transport.FullBytes, transport.PatchRequests, transport.PatchBytes, transport.PatchTargetBytes, transport.PatchFallbacks
	out.Body.Transport.BsdiffSavedBytes = transport.PatchTargetBytes - transport.PatchBytes
	if transport.PatchRequests+transport.PatchFallbacks > 0 {
		out.Body.Transport.BsdiffHitRate = float64(transport.PatchRequests) / float64(transport.PatchRequests+transport.PatchFallbacks)
	}
	return out, nil
}

func (s *Server) activity(ctx context.Context, input *adminActivityInput) (*adminActivityOutput, error) {
	start, end, err := metricRangeValues(input.Start, input.End)
	if err != nil {
		return nil, err
	}
	filters := db.GetChannelActivitySeriesParams{Day: pgtype.Date{Time: start, Valid: true}, Day_2: pgtype.Date{Time: end.AddDate(0, 0, 1), Valid: true}, Channel: pgtype.Text{String: input.Channel, Valid: input.Channel != ""}, Platform: pgtype.Text{String: input.Platform, Valid: input.Platform != ""}}
	active, err := s.DB.Queries.GetChannelActivitySeries(ctx, filters)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	versions, err := s.DB.Queries.GetVersionActivitySeries(ctx, db.GetVersionActivitySeriesParams(filters))
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	out := &adminActivityOutput{}
	out.Body.Start, out.Body.End = start, end
	out.Body.ActiveInstallations = make([]adminActivePoint, 0, len(active))
	out.Body.Versions = make([]adminVersionPoint, 0, len(versions))
	for _, row := range active {
		out.Body.ActiveInstallations = append(out.Body.ActiveInstallations, adminActivePoint{Day: row.Day.Time, ActiveInstallations: row.ActiveInstallations})
	}
	for _, row := range versions {
		out.Body.Versions = append(out.Body.Versions, adminVersionPoint{Day: row.Day.Time, ClientVersion: row.ClientVersion, ClientBuildVersion: row.ClientBuildVersion, ActiveInstallations: row.ActiveInstallations})
	}
	return out, nil
}

func (s *Server) lifecycle(ctx context.Context, input *adminLifecycleInput) (*adminLifecycleOutput, error) {
	start, end, err := metricRangeValues(input.Start, input.End)
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.Queries.GetUpdateGroupLifecycleSeries(ctx, db.GetUpdateGroupLifecycleSeriesParams{GroupID: pgUUID(&input.GroupID), ConfirmedAt: pgtype.Timestamptz{Time: start, Valid: true}, ConfirmedAt_2: pgtype.Timestamptz{Time: end, Valid: true}})
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	out := &adminLifecycleOutput{}
	out.Body.Start, out.Body.End = start, end
	out.Body.Series = make([]adminLifecyclePoint, 0, len(rows))
	for _, row := range rows {
		out.Body.Series = append(out.Body.Series, adminLifecyclePoint{Day: row.Day.Time, KnownLaunches: row.KnownLaunches, KnownCrashes: row.KnownCrashes})
	}
	return out, nil
}
