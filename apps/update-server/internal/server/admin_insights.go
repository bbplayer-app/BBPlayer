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
type adminInsightsOutput struct {
	Body struct {
		Summary struct {
			UniqueUsers       int64   `json:"unique_users"`
			Downloads         int64   `json:"downloads"`
			LaunchSuccesses   int64   `json:"launch_successes"`
			LaunchFailures    int64   `json:"launch_failures"`
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
	huma.Register(api, huma.Operation{OperationID: "getUpdateGroupLifecycle", Method: http.MethodGet, Path: "/admin/insights/groups/{groupID}/lifecycle", Summary: "Get update group lifecycle", Tags: []string{"Insights"}, Security: security}, s.lifecycle)
}
func registerAdminInsightsSummaryRoute(s *Server, api huma.API) {
	huma.Register(api, huma.Operation{OperationID: "getInsights", Method: http.MethodGet, Path: "/admin/insights", Summary: "Get update insights", Tags: []string{"Insights"}, Security: []map[string][]string{{adminSecurityScheme: {}}}}, s.insights)
}

func (s *Server) insights(ctx context.Context, input *adminInsightsInput) (*adminInsightsOutput, error) {
	groupID := pgtype.UUID{}
	if input.GroupID != "" {
		id, parseErr := uuid.Parse(input.GroupID)
		if parseErr != nil {
			return nil, huma.Error400BadRequest("group_id")
		}
		groupID = pgUUID(&id)
	}
	channel := pgtype.Text{String: input.Channel, Valid: input.Channel != ""}
	runtimeVersion := pgtype.Text{String: input.RuntimeVersion, Valid: input.RuntimeVersion != ""}
	platform := pgtype.Text{String: input.Platform, Valid: input.Platform != ""}
	summary, err := s.DB.Queries.GetEventInsightSummary(ctx, db.GetEventInsightSummaryParams{Channel: channel, RuntimeVersion: runtimeVersion, Platform: platform, GroupID: groupID})
	if err != nil {
		return nil, s.dbError("insights: summary", err)
	}
	transport, err := s.DB.Queries.GetTransportInsightSummary(ctx, db.GetTransportInsightSummaryParams{Channel: channel, RuntimeVersion: runtimeVersion, Platform: platform, GroupID: groupID})
	if err != nil {
		return nil, s.dbError("insights: transport", err)
	}
	out := &adminInsightsOutput{}
	out.Body.Summary.UniqueUsers = summary.UniqueUsers
	out.Body.Summary.LaunchSuccesses = summary.LaunchSuccesses
	out.Body.Summary.LaunchFailures = summary.LaunchFailures
	out.Body.Summary.Downloads = transport.FullRequests + transport.PatchRequests
	if total := summary.LaunchSuccesses + summary.LaunchFailures; total > 0 {
		out.Body.Summary.LaunchFailureRate = float64(summary.LaunchFailures) / float64(total)
	}
	out.Body.Transport.FullRequests, out.Body.Transport.FullBytes, out.Body.Transport.BsdiffRequests, out.Body.Transport.BsdiffBytes, out.Body.Transport.BsdiffTargetBytes, out.Body.Transport.BsdiffFallbacks = transport.FullRequests, transport.FullBytes, transport.PatchRequests, transport.PatchBytes, transport.PatchTargetBytes, transport.PatchFallbacks
	out.Body.Transport.BsdiffSavedBytes = transport.PatchTargetBytes - transport.PatchBytes
	if transport.PatchRequests+transport.PatchFallbacks > 0 {
		out.Body.Transport.BsdiffHitRate = float64(transport.PatchRequests) / float64(transport.PatchRequests+transport.PatchFallbacks)
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
		return nil, s.dbError("insights: lifecycle", err)
	}
	out := &adminLifecycleOutput{}
	out.Body.Start, out.Body.End = start, end
	out.Body.Series = make([]adminLifecyclePoint, 0, len(rows))
	for _, row := range rows {
		out.Body.Series = append(out.Body.Series, adminLifecyclePoint{Day: row.Day.Time, KnownLaunches: row.KnownLaunches, KnownCrashes: row.KnownCrashes})
	}
	return out, nil
}
