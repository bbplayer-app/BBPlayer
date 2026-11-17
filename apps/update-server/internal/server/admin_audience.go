package server

import (
	"context"
	"net/http"
	"time"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgtype"
)

// Audience days are UTC calendar days, matching installation_activity_days.
const (
	audienceDateLayout     = "2006-01-02"
	audienceRetentionWeeks = 8
)

type adminAudienceInput struct {
	Days     int    `query:"days" default:"28" minimum:"1" maximum:"400" doc:"Number of complete UTC days ending the day before end"`
	End      string `query:"end" doc:"Exclusive end day (YYYY-MM-DD, UTC); defaults to today, so the range ends yesterday"`
	Channel  string `query:"channel"`
	Platform string `query:"platform"`
}

type adminAudienceTotals struct {
	ActiveUsers    int64 `json:"active_users"`
	NewUsers       int64 `json:"new_users"`
	ActiveUserDays int64 `json:"active_user_days"`
}

type adminAudiencePoint struct {
	Day      string `json:"day"`
	DAU      int64  `json:"dau"`
	WAU      int64  `json:"wau"`
	MAU      int64  `json:"mau"`
	NewUsers int64  `json:"new_users"`
}

type adminAudienceVersion struct {
	ClientVersion string `json:"client_version"`
	Users         int64  `json:"users"`
	OTAUsers      int64  `json:"ota_users"`
}

type adminAudienceChannel struct {
	Channel string `json:"channel"`
	Users   int64  `json:"users"`
}

type adminAudienceCohort struct {
	Cohort string `json:"cohort"`
	// Weeks[0] is the cohort size; Weeks[n] is how many were active n weeks later.
	Weeks []int64 `json:"weeks"`
}

type adminAudienceOutput struct {
	Body struct {
		Start         string                 `json:"start"`
		End           string                 `json:"end"`
		PreviousStart string                 `json:"previous_start"`
		DataStart     string                 `json:"data_start"`
		Current       adminAudienceTotals    `json:"current"`
		Previous      adminAudienceTotals    `json:"previous"`
		Today         adminAudienceTotals    `json:"today"`
		Series        []adminAudiencePoint   `json:"series"`
		Versions      []adminAudienceVersion `json:"versions"`
		Channels      []adminAudienceChannel `json:"channels"`
		Retention     []adminAudienceCohort  `json:"retention"`
	}
}

func registerAdminAudienceRoutes(s *Server, api huma.API) {
	huma.Register(api, huma.Operation{OperationID: "getAudience", Method: http.MethodGet, Path: "/admin/audience", Summary: "Get active-user audience metrics", Tags: []string{"Insights"}, Security: []map[string][]string{{adminSecurityScheme: {}}}}, s.audience)
}

func pgDate(t time.Time) pgtype.Date { return pgtype.Date{Time: t, Valid: true} }

func audienceDay(d pgtype.Date) string { return d.Time.Format(audienceDateLayout) }

func (s *Server) audience(ctx context.Context, input *adminAudienceInput) (*adminAudienceOutput, error) {
	end := time.Now().UTC().Truncate(24 * time.Hour)
	if input.End != "" {
		parsed, err := time.Parse(audienceDateLayout, input.End)
		if err != nil {
			return nil, huma.Error400BadRequest("end must be YYYY-MM-DD")
		}
		end = parsed
	}
	start := end.AddDate(0, 0, -input.Days)
	previousStart := start.AddDate(0, 0, -input.Days)
	channel := pgtype.Text{String: input.Channel, Valid: input.Channel != ""}
	platform := pgtype.Text{String: input.Platform, Valid: input.Platform != ""}
	q := s.DB.Queries

	totals := func(from, to time.Time) (adminAudienceTotals, error) {
		row, err := q.GetAudienceTotals(ctx, db.GetAudienceTotalsParams{StartDay: pgDate(from), EndDay: pgDate(to), Channel: channel, Platform: platform})
		return adminAudienceTotals{ActiveUsers: row.ActiveUsers, NewUsers: row.NewUsers, ActiveUserDays: row.ActiveUserDays}, err
	}

	out := &adminAudienceOutput{}
	out.Body.Start, out.Body.End, out.Body.PreviousStart = start.Format(audienceDateLayout), end.Format(audienceDateLayout), previousStart.Format(audienceDateLayout)

	dataStart, err := q.GetAudienceDataStart(ctx)
	if err != nil {
		return nil, s.dbError("audience: data start", err)
	}
	out.Body.DataStart = audienceDay(dataStart)

	if out.Body.Current, err = totals(start, end); err != nil {
		return nil, s.dbError("audience: current totals", err)
	}
	if out.Body.Previous, err = totals(previousStart, start); err != nil {
		return nil, s.dbError("audience: previous totals", err)
	}
	// Today is still in progress, so it stays out of the range and is reported on its own.
	today := time.Now().UTC().Truncate(24 * time.Hour)
	if out.Body.Today, err = totals(today, today.AddDate(0, 0, 1)); err != nil {
		return nil, s.dbError("audience: today totals", err)
	}

	series, err := q.GetAudienceSeries(ctx, db.GetAudienceSeriesParams{StartDay: pgDate(start), EndDay: pgDate(end), Channel: channel, Platform: platform})
	if err != nil {
		return nil, s.dbError("audience: series", err)
	}
	out.Body.Series = make([]adminAudiencePoint, 0, len(series))
	for _, row := range series {
		out.Body.Series = append(out.Body.Series, adminAudiencePoint{Day: audienceDay(row.Day), DAU: row.Dau, WAU: row.Wau, MAU: row.Mau, NewUsers: row.NewUsers})
	}

	versions, err := q.ListAudienceVersions(ctx, db.ListAudienceVersionsParams{StartDay: pgDate(start), EndDay: pgDate(end), Channel: channel, Platform: platform})
	if err != nil {
		return nil, s.dbError("audience: versions", err)
	}
	out.Body.Versions = make([]adminAudienceVersion, 0, len(versions))
	for _, row := range versions {
		out.Body.Versions = append(out.Body.Versions, adminAudienceVersion{ClientVersion: row.ClientVersion, Users: row.Users, OTAUsers: row.OtaUsers})
	}

	// Channels ignore the channel filter so the page can list every option.
	channels, err := q.ListAudienceChannels(ctx, db.ListAudienceChannelsParams{StartDay: pgDate(start), EndDay: pgDate(end), Platform: platform})
	if err != nil {
		return nil, s.dbError("audience: channels", err)
	}
	out.Body.Channels = make([]adminAudienceChannel, 0, len(channels))
	for _, row := range channels {
		out.Body.Channels = append(out.Body.Channels, adminAudienceChannel{Channel: row.Channel, Users: row.Users})
	}

	// Postgres weeks start on Monday; the newest cohort is the week holding the last day of the range.
	lastDay := end.AddDate(0, 0, -1)
	lastWeek := lastDay.AddDate(0, 0, -((int(lastDay.Weekday()) + 6) % 7))
	since := lastWeek.AddDate(0, 0, -7*(audienceRetentionWeeks-1))
	retention, err := q.ListAudienceRetention(ctx, db.ListAudienceRetentionParams{SinceDay: pgDate(since), EndDay: pgDate(end), Channel: channel, Platform: platform})
	if err != nil {
		return nil, s.dbError("audience: retention", err)
	}
	out.Body.Retention = []adminAudienceCohort{}
	for _, row := range retention {
		cohort := audienceDay(row.Cohort)
		if n := len(out.Body.Retention); n == 0 || out.Body.Retention[n-1].Cohort != cohort {
			out.Body.Retention = append(out.Body.Retention, adminAudienceCohort{Cohort: cohort, Weeks: []int64{}})
		}
		current := &out.Body.Retention[len(out.Body.Retention)-1]
		for len(current.Weeks) < int(row.WeekOffset) {
			current.Weeks = append(current.Weeks, 0)
		}
		current.Weeks = append(current.Weeks, row.Users)
	}
	return out, nil
}
