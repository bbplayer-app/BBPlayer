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

type adminServiceMetricsInput struct {
	Start time.Time `query:"start" format:"date-time"`
	End   time.Time `query:"end" format:"date-time"`
	Route string    `query:"route"`
}
type adminServiceMetricPoint struct {
	Minute            time.Time `json:"minute"`
	Requests          int64     `json:"requests"`
	Errors            int64     `json:"errors"`
	ErrorRate         float64   `json:"error_rate"`
	AverageDurationMS float64   `json:"average_duration_ms"`
}
type adminServiceMetricsOutput struct {
	Body struct {
		Start  time.Time                 `json:"start"`
		End    time.Time                 `json:"end"`
		Series []adminServiceMetricPoint `json:"series"`
	}
}
type adminDeliveryMetricsInput struct {
	Start          time.Time `query:"start" format:"date-time"`
	End            time.Time `query:"end" format:"date-time"`
	Channel        string    `query:"channel"`
	RuntimeVersion string    `query:"runtime_version"`
	Platform       string    `query:"platform"`
	GroupID        string    `query:"group_id" format:"uuid"`
}
type adminDeliveryMetricPoint struct {
	Day          time.Time `json:"day"`
	Kind         string    `json:"kind"`
	Outcome      string    `json:"outcome"`
	Requests     int64     `json:"requests"`
	Bytes        int64     `json:"bytes"`
	TargetBytes  int64     `json:"target_bytes"`
	AverageBytes float64   `json:"average_bytes"`
}
type adminDeliveryMetricsOutput struct {
	Body struct {
		Start  time.Time                  `json:"start"`
		End    time.Time                  `json:"end"`
		Series []adminDeliveryMetricPoint `json:"series"`
	}
}

func registerAdminMetricRoutes(s *Server, api huma.API) {
	huma.Register(api, huma.Operation{OperationID: "getServiceMetrics", Method: http.MethodGet, Path: "/admin/metrics/service", Summary: "Get service metrics", Tags: []string{"Metrics"}, Security: []map[string][]string{{adminSecurityScheme: {}}}}, s.serviceMetrics)
	huma.Register(api, huma.Operation{OperationID: "getDeliveryMetrics", Method: http.MethodGet, Path: "/admin/metrics/delivery", Summary: "Get delivery metrics", Tags: []string{"Metrics"}, Security: []map[string][]string{{adminSecurityScheme: {}}}}, s.deliveryMetrics)
}

func (s *Server) deliveryMetrics(ctx context.Context, input *adminDeliveryMetricsInput) (*adminDeliveryMetricsOutput, error) {
	start, end, err := metricRangeValues(input.Start, input.End)
	if err != nil {
		return nil, err
	}
	filters := db.GetDeliveryMetricSeriesParams{Minute: pgtype.Timestamptz{Time: start, Valid: true}, Minute_2: pgtype.Timestamptz{Time: end, Valid: true}, Channel: pgtype.Text{String: input.Channel, Valid: input.Channel != ""}, RuntimeVersion: pgtype.Text{String: input.RuntimeVersion, Valid: input.RuntimeVersion != ""}, Platform: pgtype.Text{String: input.Platform, Valid: input.Platform != ""}}
	if input.GroupID != "" {
		id, parseErr := uuid.Parse(input.GroupID)
		if parseErr != nil {
			return nil, huma.Error400BadRequest("group_id")
		}
		filters.GroupID = pgUUID(&id)
	}
	rows, err := s.DB.Queries.GetDeliveryMetricSeries(ctx, filters)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	out := &adminDeliveryMetricsOutput{}
	out.Body.Start, out.Body.End = start, end
	out.Body.Series = make([]adminDeliveryMetricPoint, 0, len(rows))
	for _, row := range rows {
		point := adminDeliveryMetricPoint{Day: row.Day.Time, Kind: row.Kind, Outcome: row.Outcome, Requests: row.RequestCount, Bytes: row.ByteCount, TargetBytes: row.TargetByteCount}
		if point.Requests > 0 {
			point.AverageBytes = float64(point.Bytes) / float64(point.Requests)
		}
		out.Body.Series = append(out.Body.Series, point)
	}
	return out, nil
}

func metricRangeValues(start, end time.Time) (time.Time, time.Time, error) {
	now := time.Now().UTC()
	if end.IsZero() {
		end = now
	} else {
		end = end.UTC()
	}
	if start.IsZero() {
		start = end.AddDate(0, 0, -7)
	} else {
		start = start.UTC()
	}
	if !start.Before(end) || end.Sub(start) > 90*24*time.Hour {
		return time.Time{}, time.Time{}, huma.Error400BadRequest("range must be positive and at most 90 days")
	}
	return start, end, nil
}

func (s *Server) serviceMetrics(ctx context.Context, input *adminServiceMetricsInput) (*adminServiceMetricsOutput, error) {
	start, end, err := metricRangeValues(input.Start, input.End)
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.Queries.GetServiceMetricSeries(ctx, db.GetServiceMetricSeriesParams{Minute: pgtype.Timestamptz{Time: start, Valid: true}, Minute_2: pgtype.Timestamptz{Time: end, Valid: true}, Route: pgtype.Text{String: input.Route, Valid: input.Route != ""}})
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	out := &adminServiceMetricsOutput{}
	out.Body.Start, out.Body.End = start, end
	out.Body.Series = make([]adminServiceMetricPoint, 0, len(rows))
	for _, row := range rows {
		point := adminServiceMetricPoint{Minute: row.Minute.Time, Requests: row.RequestCount, Errors: row.ErrorCount}
		if point.Requests > 0 {
			point.ErrorRate = float64(point.Errors) / float64(point.Requests)
			point.AverageDurationMS = float64(row.DurationMs) / float64(point.Requests)
		}
		out.Body.Series = append(out.Body.Series, point)
	}
	return out, nil
}
