package server

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type publishRequest struct {
	Channel        string          `json:"channel"`
	RuntimeVersion string          `json:"runtime_version"`
	Message        string          `json:"message"`
	Source         json.RawMessage `json:"source"`
}
type exportMeta struct {
	FileMetadata map[string]struct {
		Bundle string `json:"bundle"`
		Assets []struct {
			Path string `json:"path"`
			Ext  string `json:"ext"`
		} `json:"assets"`
	} `json:"fileMetadata"`
}

func sha(b []byte) string { h := sha256.Sum256(b); return base64.RawURLEncoding.EncodeToString(h[:]) }
func (s *Server) publish(w http.ResponseWriter, r *http.Request) {
	if e := r.ParseMultipartForm(1 << 30); e != nil {
		http.Error(w, "multipart archive required", 400)
		return
	}
	var req publishRequest
	if json.Unmarshal([]byte(r.FormValue("request")), &req) != nil || req.Channel == "" || req.RuntimeVersion == "" || req.Message == "" || len(req.Source) == 0 {
		http.Error(w, "invalid publish request", 400)
		return
	}
	f, _, e := r.FormFile("archive")
	if e != nil {
		http.Error(w, "archive required", 400)
		return
	}
	defer f.Close()
	tmp, e := os.CreateTemp("", "update-*.zip")
	if e != nil {
		http.Error(w, "temp", 500)
		return
	}
	defer os.Remove(tmp.Name())
	if _, e = io.Copy(tmp, f); e != nil {
		http.Error(w, "archive", 400)
		return
	}
	_ = tmp.Close()
	zr, e := zip.OpenReader(tmp.Name())
	if e != nil {
		http.Error(w, "invalid zip", 400)
		return
	}
	defer zr.Close()
	files := map[string]*zip.File{}
	for _, z := range zr.File {
		if strings.HasPrefix(z.Name, "/") || strings.Contains(z.Name, "..") {
			http.Error(w, "unsafe archive path", 400)
			return
		}
		files[strings.ReplaceAll(z.Name, "\\", "/")] = z
	}
	read := func(n string) ([]byte, error) {
		z := files[n]
		if z == nil {
			return nil, os.ErrNotExist
		}
		x, e := z.Open()
		if e != nil {
			return nil, e
		}
		defer x.Close()
		return io.ReadAll(x)
	}
	mb, e := read("metadata.json")
	if e != nil {
		http.Error(w, "metadata.json missing", 400)
		return
	}
	cb, e := read("expoConfig.json")
	if e != nil {
		http.Error(w, "expoConfig.json missing", 400)
		return
	}
	var meta exportMeta
	if json.Unmarshal(mb, &meta) != nil || len(meta.FileMetadata) == 0 {
		http.Error(w, "invalid metadata.json", 400)
		return
	}
	var cfg any
	if json.Unmarshal(cb, &cfg) != nil {
		http.Error(w, "invalid expoConfig.json", 400)
		return
	}
	gid := uuid.New()
	tx, e := s.DB.Pool.Begin(r.Context())
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	defer tx.Rollback(r.Context())
	_, e = tx.Exec(r.Context(), "INSERT INTO update_groups(id,channel,runtime_version,message,source,expo_config,metadata_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)", gid, req.Channel, req.RuntimeVersion, req.Message, req.Source, cfg, sha(mb))
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	var provenance struct {
		Commits []struct {
			SHA        string    `json:"sha"`
			ParentSHA  string    `json:"parent_sha"`
			Subject    string    `json:"subject"`
			Author     string    `json:"author"`
			AuthoredAt time.Time `json:"authored_at"`
		} `json:"commits"`
	}
	if json.Unmarshal(req.Source, &provenance) == nil {
		for ordinal, commit := range provenance.Commits {
			_, e = tx.Exec(r.Context(), "INSERT INTO source_commits(update_group_id,ordinal,commit_sha,parent_sha,subject,author_name,authored_at) VALUES($1,$2,$3,$4,$5,$6,$7)", gid, ordinal, commit.SHA, commit.ParentSHA, commit.Subject, commit.Author, commit.AuthoredAt)
			if e != nil {
				http.Error(w, "database", 500)
				return
			}
		}
	}
	for platform, m := range meta.FileMetadata {
		if platform != "android" && platform != "ios" {
			continue
		}
		// Capture the currently visible launch bundle before the channel pointer
		// changes. The worker will create exactly this adjacent-head patch.
		var previousUpdate *uuid.UUID
		err := tx.QueryRow(r.Context(), `SELECT u.id
FROM channel_heads h JOIN updates u ON u.group_id=h.group_id AND u.platform=h.platform
WHERE h.channel=$1 AND h.runtime_version=$2 AND h.platform=$3 AND h.mode='ota'`, req.Channel, req.RuntimeVersion, platform).Scan(&previousUpdate)
		if err == pgx.ErrNoRows {
			previousUpdate = nil
		} else if err != nil {
			http.Error(w, "database", 500)
			return
		}

		bundle, e := read(m.Bundle)
		if e != nil {
			http.Error(w, "bundle missing", 400)
			return
		}
		uid := uuid.New()
		launchKey := path.Base(m.Bundle)
		object := path.Join("updates", gid.String(), platform, m.Bundle)
		if e = s.Objects.Put(r.Context(), object, "application/javascript", bundle); e != nil {
			http.Error(w, "r2 upload", 502)
			return
		}
		_, e = tx.Exec(r.Context(), "INSERT INTO updates(id,group_id,platform,launch_key,launch_hash) VALUES($1,$2,$3,$4,$5)", uid, gid, platform, launchKey, sha(bundle))
		if e != nil {
			http.Error(w, "database", 500)
			return
		}
		_, e = tx.Exec(r.Context(), "INSERT INTO assets(update_id,asset_key,object_key,sha256,content_type,size_bytes,is_launch) VALUES($1,$2,$3,$4,$5,$6,true)", uid, launchKey, object, sha(bundle), "application/javascript", len(bundle))
		if e != nil {
			http.Error(w, "database", 500)
			return
		}
		for _, a := range m.Assets {
			b, e := read(a.Path)
			if e != nil {
				http.Error(w, "asset missing", 400)
				return
			}
			k := path.Base(a.Path)
			ct := mime.TypeByExtension("." + a.Ext)
			if ct == "" {
				ct = "application/octet-stream"
			}
			obj := path.Join("updates", gid.String(), platform, a.Path)
			if e = s.Objects.Put(r.Context(), obj, ct, b); e != nil {
				http.Error(w, "r2 upload", 502)
				return
			}
			_, e = tx.Exec(r.Context(), "INSERT INTO assets(update_id,asset_key,object_key,sha256,content_type,size_bytes) VALUES($1,$2,$3,$4,$5,$6)", uid, k, obj, sha(b), ct, len(b))
			if e != nil {
				http.Error(w, "database", 500)
				return
			}
		}
		if previousUpdate != nil {
			_, e = tx.Exec(r.Context(), "INSERT INTO patches(from_update_id,to_update_id,platform,status) VALUES($1,$2,$3,'pending') ON CONFLICT(from_update_id,to_update_id) DO NOTHING", *previousUpdate, uid, platform)
			if e != nil {
				http.Error(w, "database", 500)
				return
			}
		}
		_, e = tx.Exec(r.Context(), "INSERT INTO channel_heads(channel,runtime_version,platform,group_id,mode) VALUES($1,$2,$3,$4,'ota') ON CONFLICT(channel,runtime_version,platform) DO UPDATE SET group_id=excluded.group_id,mode='ota',updated_at=now()", req.Channel, req.RuntimeVersion, platform, gid)
		if e == nil {
			_, e = tx.Exec(r.Context(), "INSERT INTO channel_history(channel,runtime_version,platform,group_id,mode,action,actor) VALUES($1,$2,$3,$4,'ota','publish','admin')", req.Channel, req.RuntimeVersion, platform, gid)
		}
	}
	if e = tx.Commit(r.Context()); e != nil {
		http.Error(w, "database", 500)
		return
	}
	writeJSON(w, 201, map[string]any{"group_id": gid})
}
func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	rows, e := s.DB.Query(r.Context(), "SELECT id,channel,runtime_version,message,created_at,source FROM update_groups ORDER BY created_at DESC LIMIT 100")
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var id uuid.UUID
		var c, rv, m string
		var t time.Time
		var src json.RawMessage
		_ = rows.Scan(&id, &c, &rv, &m, &t, &src)
		out = append(out, map[string]any{"id": id, "channel": c, "runtime_version": rv, "message": m, "created_at": t, "source": json.RawMessage(src)})
	}
	writeJSON(w, 200, out)
}
func (s *Server) show(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var c, rv, m string
	var t time.Time
	var src json.RawMessage
	e := s.DB.Pool.QueryRow(r.Context(), "SELECT channel,runtime_version,message,created_at,source FROM update_groups WHERE id=$1", id).Scan(&c, &rv, &m, &t, &src)
	if e == pgx.ErrNoRows {
		http.NotFound(w, r)
		return
	}
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	writeJSON(w, 200, map[string]any{"id": id, "channel": c, "runtime_version": rv, "message": m, "created_at": t, "source": json.RawMessage(src)})
}
func (s *Server) rollback(w http.ResponseWriter, r *http.Request) {
	var q struct {
		RuntimeVersion string `json:"runtime_version"`
		Platform       string `json:"platform"`
		Mode           string `json:"mode"`
		GroupID        string `json:"group_id"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil || q.RuntimeVersion == "" || q.Platform == "" || q.Mode == "" {
		http.Error(w, "runtime_version, platform, mode required", 400)
		return
	}
	var g any = nil
	if q.Mode == "ota" {
		id, e := uuid.Parse(q.GroupID)
		if e != nil {
			http.Error(w, "group_id", 400)
			return
		}
		g = id
		var exists bool
		if e = s.DB.Pool.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM updates u JOIN update_groups ug ON ug.id=u.group_id WHERE ug.id=$1 AND ug.channel=$2 AND ug.runtime_version=$3 AND u.platform=$4)", id, chi.URLParam(r, "channel"), q.RuntimeVersion, q.Platform).Scan(&exists); e != nil || !exists {
			http.Error(w, "incompatible update group", 400)
			return
		}
	}
	_, e := s.DB.Pool.Exec(r.Context(), "INSERT INTO channel_heads(channel,runtime_version,platform,group_id,mode) VALUES($1,$2,$3,$4,$5) ON CONFLICT(channel,runtime_version,platform) DO UPDATE SET group_id=excluded.group_id,mode=excluded.mode,updated_at=now()", chi.URLParam(r, "channel"), q.RuntimeVersion, q.Platform, g, q.Mode)
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	_, _ = s.DB.Pool.Exec(r.Context(), "INSERT INTO channel_history(channel,runtime_version,platform,group_id,mode,action,actor) VALUES($1,$2,$3,$4,$5,'rollback','admin')", chi.URLParam(r, "channel"), q.RuntimeVersion, q.Platform, g, q.Mode)
	writeJSON(w, 200, map[string]string{"status": "rolled back"})
}
func (s *Server) channels(w http.ResponseWriter, r *http.Request) {
	rows, e := s.DB.Query(r.Context(), "SELECT channel,runtime_version,platform,group_id,mode,updated_at FROM channel_heads ORDER BY channel,runtime_version,platform")
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var c, rv, p, m string
		var g *uuid.UUID
		var at time.Time
		if e = rows.Scan(&c, &rv, &p, &g, &m, &at); e != nil {
			http.Error(w, "database", 500)
			return
		}
		out = append(out, map[string]any{"channel": c, "runtime_version": rv, "platform": p, "group_id": g, "mode": m, "updated_at": at})
	}
	writeJSON(w, 200, out)
}
func (s *Server) channel(w http.ResponseWriter, r *http.Request) {
	rows, e := s.DB.Query(r.Context(), "SELECT runtime_version,platform,group_id,mode,updated_at FROM channel_heads WHERE channel=$1 ORDER BY runtime_version,platform", chi.URLParam(r, "channel"))
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var rv, p, m string
		var g *uuid.UUID
		var at time.Time
		if e = rows.Scan(&rv, &p, &g, &m, &at); e != nil {
			http.Error(w, "database", 500)
			return
		}
		out = append(out, map[string]any{"runtime_version": rv, "platform": p, "group_id": g, "mode": m, "updated_at": at})
	}
	writeJSON(w, 200, out)
}
func (s *Server) history(w http.ResponseWriter, r *http.Request) {
	rows, e := s.DB.Query(r.Context(), "SELECT group_id,mode,action,created_at FROM channel_history WHERE channel=$1 ORDER BY created_at DESC", chi.URLParam(r, "channel"))
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var g *uuid.UUID
		var m, a string
		var t time.Time
		_ = rows.Scan(&g, &m, &a, &t)
		out = append(out, map[string]any{"group_id": g, "mode": m, "action": a, "created_at": t})
	}
	writeJSON(w, 200, out)
}
func (s *Server) sourceFind(w http.ResponseWriter, r *http.Request) {
	rows, e := s.DB.Query(r.Context(), `SELECT ug.id,ug.channel,ug.runtime_version,ug.message,ug.created_at
FROM update_groups ug
WHERE ug.source->>'commit_sha'=$1
   OR EXISTS (SELECT 1 FROM source_commits sc WHERE sc.update_group_id=ug.id AND sc.commit_sha=$1)
ORDER BY ug.created_at DESC`, chi.URLParam(r, "commit"))
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var id uuid.UUID
		var c, rv, m string
		var t time.Time
		_ = rows.Scan(&id, &c, &rv, &m, &t)
		out = append(out, map[string]any{"id": id, "channel": c, "runtime_version": rv, "message": m, "created_at": t})
	}
	writeJSON(w, 200, out)
}
func (s *Server) sourceLatest(w http.ResponseWriter, r *http.Request) {
	channel, runtimeVersion := r.URL.Query().Get("channel"), r.URL.Query().Get("runtime_version")
	commit, err := s.DB.LatestSourceCommit(r.Context(), channel, runtimeVersion)
	if err != nil {
		http.Error(w, "database", 500)
		return
	}
	writeJSON(w, 200, map[string]string{"commit_sha": commit})
}
func (s *Server) sourceCompare(w http.ResponseWriter, r *http.Request) {
	from, to := chi.URLParam(r, "from"), chi.URLParam(r, "to")
	var fromSource, toSource json.RawMessage
	if e := s.DB.Pool.QueryRow(r.Context(), "SELECT source FROM update_groups WHERE id=$1", from).Scan(&fromSource); e != nil {
		http.NotFound(w, r)
		return
	}
	if e := s.DB.Pool.QueryRow(r.Context(), "SELECT source FROM update_groups WHERE id=$1", to).Scan(&toSource); e != nil {
		http.NotFound(w, r)
		return
	}
	var a, b struct {
		Repository string `json:"repository"`
		Commit     string `json:"commit_sha"`
	}
	_ = json.Unmarshal(fromSource, &a)
	_ = json.Unmarshal(toSource, &b)
	rows, e := s.DB.Query(r.Context(), "SELECT update_group_id,ordinal,commit_sha,parent_sha,subject,author_name,authored_at FROM source_commits WHERE update_group_id=$1 OR update_group_id=$2 ORDER BY update_group_id,ordinal", from, to)
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	defer rows.Close()
	allCommits := []any{}
	includedCommits := []any{}
	for rows.Next() {
		var g uuid.UUID
		var o int
		var sha, subject string
		var parent, author *string
		var at *time.Time
		if e = rows.Scan(&g, &o, &sha, &parent, &subject, &author, &at); e != nil {
			http.Error(w, "database", 500)
			return
		}
		commit := map[string]any{"group_id": g, "ordinal": o, "commit_sha": sha, "parent_sha": parent, "subject": subject, "author": author, "authored_at": at}
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
		var metadata string
		var expoConfig json.RawMessage
		if e := s.DB.Pool.QueryRow(r.Context(), "SELECT metadata_sha256,expo_config FROM update_groups WHERE id=$1", group).Scan(&metadata, &expoConfig); e != nil {
			return nil
		}
		rows, e := s.DB.Query(r.Context(), "SELECT platform,launch_hash FROM updates WHERE group_id=$1 ORDER BY platform", group)
		if e != nil {
			return nil
		}
		defer rows.Close()
		launch := map[string]string{}
		for rows.Next() {
			var platform, hash string
			if rows.Scan(&platform, &hash) == nil {
				launch[platform] = hash
			}
		}
		configHash := sha([]byte(expoConfig))
		return map[string]any{"metadata_sha256": metadata, "expo_config_sha256": configHash, "launch_bundle_sha256": launch}
	}
	writeJSON(w, 200, map[string]any{"from": from, "to": to, "from_artifacts": artifacts(from), "to_artifacts": artifacts(to), "included_commits": includedCommits, "commits": allCommits, "github_compare_url": compareURL})
}
func (s *Server) insights(w http.ResponseWriter, r *http.Request) {
	where := "occurred_at >= now()-interval '7 days'"
	args := []any{}
	if channel := r.URL.Query().Get("channel"); channel != "" {
		args = append(args, channel)
		where += " AND channel=$" + strconv.Itoa(len(args))
	}
	if runtimeVersion := r.URL.Query().Get("runtime_version"); runtimeVersion != "" {
		args = append(args, runtimeVersion)
		where += " AND runtime_version=$" + strconv.Itoa(len(args))
	}
	if platform := r.URL.Query().Get("platform"); platform != "" {
		args = append(args, platform)
		where += " AND platform=$" + strconv.Itoa(len(args))
	}
	if group := r.URL.Query().Get("group_id"); group != "" {
		id, e := uuid.Parse(group)
		if e != nil {
			http.Error(w, "group_id", 400)
			return
		}
		args = append(args, id)
		where += " AND group_id=$" + strconv.Itoa(len(args))
	}
	rows, e := s.DB.Query(r.Context(), "SELECT event_type,count(*),count(DISTINCT installation_hmac) FROM update_events WHERE "+where+" GROUP BY event_type ORDER BY event_type", args...)
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var t string
		var n, u int64
		_ = rows.Scan(&t, &n, &u)
		out = append(out, map[string]any{"event_type": t, "events": n, "unique_installations": u})
	}
	var unique, checks, downloads, launches, successes, failures, emergency int64
	summarySQL := "SELECT count(DISTINCT installation_hmac),count(*) FILTER (WHERE event_type LIKE 'update_check%'),count(*) FILTER (WHERE event_type LIKE 'download%'),count(*) FILTER (WHERE event_type='launch_started'),count(*) FILTER (WHERE event_type='launch_succeeded'),count(*) FILTER (WHERE event_type IN ('launch_failed','error_recovery')),count(*) FILTER (WHERE event_type='emergency_launch') FROM update_events WHERE " + where
	if e = s.DB.Pool.QueryRow(r.Context(), summarySQL, args...).Scan(&unique, &checks, &downloads, &launches, &successes, &failures, &emergency); e != nil {
		http.Error(w, "database", 500)
		return
	}
	failureRate := float64(0)
	if launches > 0 {
		failureRate = float64(failures) / float64(launches)
	}
	var patchRequests, patchFallbacks, fullRequests, patchBytes, targetBytes, fullBytes int64
	transportSQL := `SELECT
 count(*) FILTER (WHERE event_type='patch_served'),
 count(*) FILTER (WHERE event_type='patch_fallback_full'),
 count(*) FILTER (WHERE event_type='asset_served'),
 COALESCE(sum((payload->>'bytes')::bigint) FILTER (WHERE event_type='patch_served'),0),
 COALESCE(sum((payload->>'target_bytes')::bigint) FILTER (WHERE event_type='patch_served'),0),
 COALESCE(sum((payload->>'bytes')::bigint) FILTER (WHERE event_type='asset_served'),0)
 FROM update_events WHERE ` + where
	if e = s.DB.Pool.QueryRow(r.Context(), transportSQL, args...).Scan(&patchRequests, &patchFallbacks, &fullRequests, &patchBytes, &targetBytes, &fullBytes); e != nil {
		http.Error(w, "database", 500)
		return
	}
	patchHitRate := float64(0)
	if patchRequests+patchFallbacks > 0 {
		patchHitRate = float64(patchRequests) / float64(patchRequests+patchFallbacks)
	}
	writeJSON(w, 200, map[string]any{"events": out, "summary": map[string]any{"unique_users": unique, "update_checks": checks, "downloads": downloads, "launches": launches, "launch_successes": successes, "launch_failures": failures, "emergency_launches": emergency, "launch_failure_rate": failureRate}, "transport": map[string]any{"full_requests": fullRequests, "full_bytes": fullBytes, "bsdiff_requests": patchRequests, "bsdiff_bytes": patchBytes, "bsdiff_target_bytes": targetBytes, "bsdiff_saved_bytes": targetBytes - patchBytes, "bsdiff_fallbacks": patchFallbacks, "bsdiff_hit_rate": patchHitRate}})
}
