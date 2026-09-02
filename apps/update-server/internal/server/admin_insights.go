package server

import (
	"net/http"
	"time"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/go-chi/chi/v5"
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
		s.logError(r, "insights: list events", err, "channel", filters.Channel.String, "runtime_version", filters.RuntimeVersion.String, "platform", filters.Platform.String)
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	events := make([]any, 0, len(rows))
	for _, row := range rows {
		events = append(events, map[string]any{"event_type": row.EventType, "events": row.EventCount, "unique_installations": row.UniqueInstallations})
	}
	summary, err := s.DB.Queries.GetEventInsightSummary(r.Context(), db.GetEventInsightSummaryParams(filters))
	if err != nil {
		s.logError(r, "insights: event summary", err, "channel", filters.Channel.String, "runtime_version", filters.RuntimeVersion.String, "platform", filters.Platform.String)
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	transport, err := s.DB.Queries.GetTransportInsightSummary(r.Context(), db.GetTransportInsightSummaryParams(filters))
	if err != nil {
		s.logError(r, "insights: transport summary", err, "channel", filters.Channel.String, "runtime_version", filters.RuntimeVersion.String, "platform", filters.Platform.String)
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

func metricRange(w http.ResponseWriter, r *http.Request) (time.Time, time.Time, bool) {
	end := time.Now().UTC()
	start := end.AddDate(0, 0, -7)
	if raw := r.URL.Query().Get("start"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			http.Error(w, "start must be RFC3339", http.StatusBadRequest)
			return time.Time{}, time.Time{}, false
		}
		start = parsed.UTC()
	}
	if raw := r.URL.Query().Get("end"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			http.Error(w, "end must be RFC3339", http.StatusBadRequest)
			return time.Time{}, time.Time{}, false
		}
		end = parsed.UTC()
	}
	if !start.Before(end) || end.Sub(start) > 90*24*time.Hour {
		http.Error(w, "range must be positive and at most 90 days", http.StatusBadRequest)
		return time.Time{}, time.Time{}, false
	}
	return start, end, true
}

func (s *Server) serviceMetricSeries(w http.ResponseWriter, r *http.Request) {
	start, end, ok := metricRange(w, r)
	if !ok {
		return
	}
	rows, err := s.DB.Queries.GetServiceMetricSeries(r.Context(), db.GetServiceMetricSeriesParams{
		Minute:   pgtype.Timestamptz{Time: start, Valid: true},
		Minute_2: pgtype.Timestamptz{Time: end, Valid: true},
		Route:    pgtype.Text{String: r.URL.Query().Get("route"), Valid: r.URL.Query().Get("route") != ""},
	})
	if err != nil {
		s.logError(r, "metrics: service series", err)
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	series := make([]any, 0, len(rows))
	for _, row := range rows {
		errorRate, averageDuration := float64(0), float64(0)
		if row.RequestCount > 0 {
			errorRate = float64(row.ErrorCount) / float64(row.RequestCount)
			averageDuration = float64(row.DurationMs) / float64(row.RequestCount)
		}
		series = append(series, map[string]any{"minute": row.Minute.Time, "requests": row.RequestCount, "errors": row.ErrorCount, "error_rate": errorRate, "average_duration_ms": averageDuration})
	}
	writeJSON(w, http.StatusOK, map[string]any{"start": start, "end": end, "series": series})
}

func (s *Server) deliveryMetricSeries(w http.ResponseWriter, r *http.Request) {
	start, end, ok := metricRange(w, r)
	if !ok {
		return
	}
	filters := db.GetDeliveryMetricSeriesParams{
		Minute:         pgtype.Timestamptz{Time: start, Valid: true},
		Minute_2:       pgtype.Timestamptz{Time: end, Valid: true},
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
	rows, err := s.DB.Queries.GetDeliveryMetricSeries(r.Context(), filters)
	if err != nil {
		s.logError(r, "metrics: delivery series", err)
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	series := make([]any, 0, len(rows))
	for _, row := range rows {
		averageBytes := float64(0)
		if row.RequestCount > 0 {
			averageBytes = float64(row.ByteCount) / float64(row.RequestCount)
		}
		series = append(series, map[string]any{"day": row.Day.Time, "kind": row.Kind, "outcome": row.Outcome, "requests": row.RequestCount, "bytes": row.ByteCount, "target_bytes": row.TargetByteCount, "average_bytes": averageBytes})
	}
	writeJSON(w, http.StatusOK, map[string]any{"start": start, "end": end, "series": series})
}

func (s *Server) activitySeries(w http.ResponseWriter, r *http.Request) {
	start, end, ok := metricRange(w, r)
	if !ok {
		return
	}
	filters := db.GetChannelActivitySeriesParams{
		Day:      pgtype.Date{Time: start, Valid: true},
		Day_2:    pgtype.Date{Time: end.AddDate(0, 0, 1), Valid: true},
		Channel:  pgtype.Text{String: r.URL.Query().Get("channel"), Valid: r.URL.Query().Get("channel") != ""},
		Platform: pgtype.Text{String: r.URL.Query().Get("platform"), Valid: r.URL.Query().Get("platform") != ""},
	}
	activeRows, err := s.DB.Queries.GetChannelActivitySeries(r.Context(), filters)
	if err != nil {
		s.logError(r, "insights: activity series", err)
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	versions, err := s.DB.Queries.GetVersionActivitySeries(r.Context(), db.GetVersionActivitySeriesParams(filters))
	if err != nil {
		s.logError(r, "insights: version series", err)
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	active := make([]any, 0, len(activeRows))
	for _, row := range activeRows {
		active = append(active, map[string]any{"day": row.Day.Time, "active_installations": row.ActiveInstallations})
	}
	versionSeries := make([]any, 0, len(versions))
	for _, row := range versions {
		versionSeries = append(versionSeries, map[string]any{"day": row.Day.Time, "client_version": row.ClientVersion, "client_build_version": row.ClientBuildVersion, "active_installations": row.ActiveInstallations})
	}
	writeJSON(w, http.StatusOK, map[string]any{"start": start, "end": end, "active_installations": active, "versions": versionSeries})
}

func (s *Server) updateGroupLifecycleSeries(w http.ResponseWriter, r *http.Request) {
	start, end, ok := metricRange(w, r)
	if !ok {
		return
	}
	groupID, err := uuid.Parse(chi.URLParam(r, "groupID"))
	if err != nil {
		http.Error(w, "group_id", http.StatusBadRequest)
		return
	}
	rows, err := s.DB.Queries.GetUpdateGroupLifecycleSeries(r.Context(), db.GetUpdateGroupLifecycleSeriesParams{GroupID: pgUUID(&groupID), ConfirmedAt: pgtype.Timestamptz{Time: start, Valid: true}, ConfirmedAt_2: pgtype.Timestamptz{Time: end, Valid: true}})
	if err != nil {
		s.logError(r, "insights: update group lifecycle", err, "group_id", groupID.String())
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	series := make([]any, 0, len(rows))
	for _, row := range rows {
		series = append(series, map[string]any{"day": row.Day.Time, "known_launches": row.KnownLaunches, "known_crashes": row.KnownCrashes})
	}
	writeJSON(w, http.StatusOK, map[string]any{"start": start, "end": end, "series": series})
}
