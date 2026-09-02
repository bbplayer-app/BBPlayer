package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Server) sourceFind(w http.ResponseWriter, r *http.Request) {
	rows, e := s.DB.Queries.FindGroupsOrSourceCommitsByCommit(r.Context(), []byte(chi.URLParam(r, "commit")))
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	out := []any{}
	for _, row := range rows {
		out = append(out, map[string]any{"id": uuid.UUID(row.ID.Bytes), "channel": row.Channel, "runtime_version": row.RuntimeVersion, "message": row.Message, "created_at": row.CreatedAt.Time})
	}
	writeJSON(w, 200, out)
}
func (s *Server) sourceLatest(w http.ResponseWriter, r *http.Request) {
	channel, runtimeVersion := r.URL.Query().Get("channel"), r.URL.Query().Get("runtime_version")
	commit, err := s.DB.Queries.LatestSourceCommit(r.Context(), db.LatestSourceCommitParams{Channel: channel, RuntimeVersion: runtimeVersion})
	if errors.Is(err, pgx.ErrNoRows) {
		commit = ""
		err = nil
	}
	if err != nil {
		http.Error(w, "database", 500)
		return
	}
	writeJSON(w, 200, map[string]string{"commit_sha": commit})
}
func (s *Server) sourceCompare(w http.ResponseWriter, r *http.Request) {
	from, to := chi.URLParam(r, "from"), chi.URLParam(r, "to")
	fromID, fromErr := uuid.Parse(from)
	toID, toErr := uuid.Parse(to)
	if fromErr != nil || toErr != nil {
		http.NotFound(w, r)
		return
	}
	fromSource, e := s.DB.Queries.GetUpdateGroupSource(r.Context(), pgUUID(&fromID))
	if e != nil {
		http.NotFound(w, r)
		return
	}
	toSource, e := s.DB.Queries.GetUpdateGroupSource(r.Context(), pgUUID(&toID))
	if e != nil {
		http.NotFound(w, r)
		return
	}
	var a, b struct {
		Repository string `json:"repository"`
		Commit     string `json:"commit_sha"`
	}
	_ = json.Unmarshal(fromSource, &a)
	_ = json.Unmarshal(toSource, &b)
	rows, e := s.DB.Queries.ListSourceCommitsForGroups(r.Context(), db.ListSourceCommitsForGroupsParams{UpdateGroupID: pgUUID(&fromID), UpdateGroupID_2: pgUUID(&toID)})
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	allCommits := []any{}
	includedCommits := []any{}
	for _, row := range rows {
		g := uuid.UUID(row.UpdateGroupID.Bytes)
		commit := map[string]any{"group_id": g, "ordinal": row.Ordinal, "commit_sha": row.CommitSha, "parent_sha": row.ParentSha, "subject": row.Subject, "author": row.AuthorName, "authored_at": row.AuthoredAt}
		allCommits = append(allCommits, commit)
		if g.String() == to {
			includedCommits = append(includedCommits, commit)
		}
	}
	compareURL := ""
	repo := strings.TrimSuffix(strings.TrimPrefix(a.Repository, "https://github.com/"), ".git")
	if repo != "" && a.Repository == b.Repository && a.Commit != "" && b.Commit != "" {
		compareURL = "https://github.com/" + repo + "/compare/" + a.Commit + "..." + b.Commit
	}
	artifacts := func(group string) map[string]any {
		id, parseErr := uuid.Parse(group)
		if parseErr != nil {
			return nil
		}
		artifacts, e := s.DB.Queries.GetUpdateGroupArtifacts(r.Context(), pgUUID(&id))
		if e != nil {
			return nil
		}
		rows, e := s.DB.Queries.ListUpdatesForGroup(r.Context(), pgUUID(&id))
		if e != nil {
			return nil
		}
		launch := map[string]string{}
		for _, row := range rows {
			launch[row.Platform] = row.LaunchHash
		}
		configHash := sha(artifacts.ExpoConfig)
		return map[string]any{"metadata_sha256": artifacts.MetadataSha256, "expo_config_sha256": configHash, "launch_bundle_sha256": launch}
	}
	writeJSON(w, 200, map[string]any{"from": from, "to": to, "from_artifacts": artifacts(from), "to_artifacts": artifacts(to), "included_commits": includedCommits, "commits": allCommits, "github_compare_url": compareURL})
}
