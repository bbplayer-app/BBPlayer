package server

import (
	"net/http"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (s *Server) insights(w http.ResponseWriter, r *http.Request) {
	filters := db.ListEventInsightsParams{
		Channel:        pgtype.Text{String: r.URL.Query().Get("channel"), Valid: r.URL.Query().Get("channel") != ""},
		RuntimeVersion: pgtype.Text{String: r.URL.Query().Get("runtime_version"), Valid: r.URL.Query().Get("runtime_version") != ""},
		Platform:       pgtype.Text{String: r.URL.Query().Get("platform"), Valid: r.URL.Query().Get("platform") != ""},
	}
	if group := r.URL.Query().Get("group_id"); group != "" {
		id, err := uuid.Parse(group)
		if err != nil {
			http.Error(w, "group_id", http.StatusBadRequest)
			return
		}
		filters.GroupID = pgUUID(&id)
	}
	rows, err := s.DB.Queries.ListEventInsights(r.Context(), filters)
	if err != nil {
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	events := make([]any, 0, len(rows))
	for _, row := range rows {
		events = append(events, map[string]any{"event_type": row.EventType, "events": row.EventCount, "unique_installations": row.UniqueInstallations})
	}
	summary, err := s.DB.Queries.GetEventInsightSummary(r.Context(), db.GetEventInsightSummaryParams(filters))
	if err != nil {
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	transport, err := s.DB.Queries.GetTransportInsightSummary(r.Context(), db.GetTransportInsightSummaryParams(filters))
	if err != nil {
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	failureRate, patchHitRate := float64(0), float64(0)
	if summary.Launches > 0 {
		failureRate = float64(summary.LaunchFailures) / float64(summary.Launches)
	}
	if transport.PatchRequests+transport.PatchFallbacks > 0 {
		patchHitRate = float64(transport.PatchRequests) / float64(transport.PatchRequests+transport.PatchFallbacks)
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": events, "summary": map[string]any{"unique_users": summary.UniqueInstallations, "update_checks": summary.UpdateChecks, "downloads": summary.Downloads, "launches": summary.Launches, "launch_successes": summary.LaunchSuccesses, "launch_failures": summary.LaunchFailures, "emergency_launches": summary.EmergencyLaunches, "launch_failure_rate": failureRate}, "transport": map[string]any{"full_requests": transport.FullRequests, "full_bytes": transport.FullBytes, "bsdiff_requests": transport.PatchRequests, "bsdiff_bytes": transport.PatchBytes, "bsdiff_target_bytes": transport.PatchTargetBytes, "bsdiff_saved_bytes": transport.PatchTargetBytes - transport.PatchBytes, "bsdiff_fallbacks": transport.PatchFallbacks, "bsdiff_hit_rate": patchHitRate}})
}
