package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type adminSourceLatestInput struct {
	Channel        string `query:"channel"`
	RuntimeVersion string `query:"runtime_version"`
}
type adminSourceLatestOutput struct {
	Body struct {
		CommitSHA string `json:"commit_sha"`
	}
}
type adminSourceCommitInput struct {
	Commit string `path:"commit" minLength:"1"`
}
type adminSourceGroup struct {
	ID             uuid.UUID `json:"id"`
	Channel        string    `json:"channel"`
	RuntimeVersion string    `json:"runtime_version"`
	Message        string    `json:"message"`
	CreatedAt      time.Time `json:"created_at"`
}
type adminSourceFindOutput struct{ Body []adminSourceGroup }
type adminSourceCompareInput struct {
	From uuid.UUID `path:"from"`
	To   uuid.UUID `path:"to"`
}
type adminSourceCompareOutput struct {
	Body struct {
		From             uuid.UUID `json:"from"`
		To               uuid.UUID `json:"to"`
		Commits          []any     `json:"commits"`
		IncludedCommits  []any     `json:"included_commits"`
		FromArtifacts    any       `json:"from_artifacts"`
		ToArtifacts      any       `json:"to_artifacts"`
		GitHubCompareURL string    `json:"github_compare_url"`
	}
}

func registerAdminSourceRoutes(s *Server, api huma.API) {
	security := []map[string][]string{{adminSecurityScheme: {}}}
	huma.Register(api, huma.Operation{OperationID: "getLatestSourceCommit", Method: http.MethodGet, Path: "/admin/source/latest", Summary: "Get latest source commit", Tags: []string{"Source"}, Security: security}, s.sourceLatest)
	huma.Register(api, huma.Operation{OperationID: "findUpdatesByCommit", Method: http.MethodGet, Path: "/admin/source/{commit}", Summary: "Find updates by commit", Tags: []string{"Source"}, Security: security}, s.sourceFind)
	huma.Register(api, huma.Operation{OperationID: "compareUpdateSources", Method: http.MethodGet, Path: "/admin/source/compare/{from}/{to}", Summary: "Compare update sources", Tags: []string{"Source"}, Security: security}, s.sourceCompare)
}

func (s *Server) sourceCompare(ctx context.Context, input *adminSourceCompareInput) (*adminSourceCompareOutput, error) {
	a, err := s.DB.Queries.GetUpdateGroupSource(ctx, pgUUID(&input.From))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, huma.Error404NotFound("from update group not found")
	}
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	b, err := s.DB.Queries.GetUpdateGroupSource(ctx, pgUUID(&input.To))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, huma.Error404NotFound("to update group not found")
	}
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	rows, err := s.DB.Queries.ListSourceCommitsForGroups(ctx, db.ListSourceCommitsForGroupsParams{UpdateGroupID: pgUUID(&input.From), UpdateGroupID_2: pgUUID(&input.To)})
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	out := &adminSourceCompareOutput{}
	out.Body.From, out.Body.To = input.From, input.To
	for _, row := range rows {
		c := map[string]any{"group_id": uuid.UUID(row.UpdateGroupID.Bytes), "ordinal": row.Ordinal, "commit_sha": row.CommitSha, "parent_sha": row.ParentSha, "subject": row.Subject, "author": row.AuthorName, "authored_at": row.AuthoredAt}
		out.Body.Commits = append(out.Body.Commits, c)
		if uuid.UUID(row.UpdateGroupID.Bytes) == input.To {
			out.Body.IncludedCommits = append(out.Body.IncludedCommits, c)
		}
	}
	var from, to struct {
		Repository string `json:"repository"`
		Commit     string `json:"commit_sha"`
	}
	_ = json.Unmarshal(a, &from)
	_ = json.Unmarshal(b, &to)
	repo := strings.TrimSuffix(strings.TrimPrefix(from.Repository, "https://github.com/"), ".git")
	if repo != "" && from.Repository == to.Repository && from.Commit != "" && to.Commit != "" {
		out.Body.GitHubCompareURL = "https://github.com/" + repo + "/compare/" + from.Commit + "..." + to.Commit
	}
	artifacts := func(id uuid.UUID) (any, error) {
		a, e := s.DB.Queries.GetUpdateGroupArtifacts(ctx, pgUUID(&id))
		if e != nil {
			return nil, e
		}
		us, e := s.DB.Queries.ListUpdatesForGroup(ctx, pgUUID(&id))
		if e != nil {
			return nil, e
		}
		h := map[string]string{}
		for _, u := range us {
			h[u.Platform] = u.LaunchHash
		}
		return map[string]any{"metadata_sha256": a.MetadataSha256, "expo_config_sha256": sha(a.ExpoConfig), "launch_bundle_sha256": h}, nil
	}
	out.Body.FromArtifacts, err = artifacts(input.From)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	out.Body.ToArtifacts, err = artifacts(input.To)
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	return out, nil
}

func (s *Server) sourceLatest(ctx context.Context, input *adminSourceLatestInput) (*adminSourceLatestOutput, error) {
	commit, err := s.DB.Queries.LatestSourceCommit(ctx, db.LatestSourceCommitParams{Channel: input.Channel, RuntimeVersion: input.RuntimeVersion})
	if err == pgx.ErrNoRows {
		commit = ""
		err = nil
	}
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	out := &adminSourceLatestOutput{}
	out.Body.CommitSHA = commit
	return out, nil
}

func (s *Server) sourceFind(ctx context.Context, input *adminSourceCommitInput) (*adminSourceFindOutput, error) {
	rows, err := s.DB.Queries.FindGroupsOrSourceCommitsByCommit(ctx, []byte(input.Commit))
	if err != nil {
		return nil, huma.Error500InternalServerError("database")
	}
	out := &adminSourceFindOutput{Body: make([]adminSourceGroup, 0, len(rows))}
	for _, row := range rows {
		out.Body = append(out.Body, adminSourceGroup{ID: uuid.UUID(row.ID.Bytes), Channel: row.Channel, RuntimeVersion: row.RuntimeVersion, Message: row.Message, CreatedAt: row.CreatedAt.Time})
	}
	return out, nil
}
