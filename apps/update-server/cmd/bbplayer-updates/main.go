package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/config"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/patchworker"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/server"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/store"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{Use: "bbplayer-updates"}
	root.AddCommand(apiCmd(), migrateCmd(), workerCmd(), publishCmd(), getCmd("list", "/admin/updates"), showCmd(), channelCmd(), rollbackCmd(), sourceCmd(), insightsCmd())
	if e := root.Execute(); e != nil {
		os.Exit(1)
	}
}
func runtime(ctx context.Context) (*server.Server, *store.Store, error) {
	c, e := config.Load()
	if e != nil {
		return nil, nil, e
	}
	db, e := store.Open(ctx, c.DatabaseURL)
	if e != nil {
		return nil, nil, e
	}
	s, e := server.New(ctx, c, db)
	return s, db, e
}
func apiCmd() *cobra.Command {
	return &cobra.Command{Use: "api", RunE: func(_ *cobra.Command, _ []string) error {
		ctx := context.Background()
		s, db, e := runtime(ctx)
		if e != nil {
			return e
		}
		defer db.Close()
		return http.ListenAndServe(":8080", s.Router())
	}}
}
func migrateCmd() *cobra.Command {
	return &cobra.Command{Use: "migrate", RunE: func(_ *cobra.Command, _ []string) error {
		url, e := config.DatabaseURL()
		if e != nil {
			return e
		}
		db, e := store.Open(context.Background(), url)
		if e != nil {
			return e
		}
		defer db.Close()
		return db.Migrate(context.Background())
	}}
}
func workerCmd() *cobra.Command {
	return &cobra.Command{Use: "worker", RunE: func(_ *cobra.Command, _ []string) error {
		s, db, e := runtime(context.Background())
		if e != nil {
			return e
		}
		defer db.Close()
		for {
			_, e = patchworker.RunOnce(context.Background(), db, s.Objects)
			if e != nil {
				return e
			}
			if e = patchworker.RollupDaily(context.Background(), db); e != nil {
				return e
			}
			time.Sleep(15 * time.Second)
		}
	}}
}
func publishCmd() *cobra.Command {
	var srv, tok, ch, dist, msg, runtimeVersion string
	var nonlinear bool
	var jsonOutput bool
	c := &cobra.Command{Use: "publish", RunE: func(_ *cobra.Command, _ []string) error {
		runtime := runtimeVersion
		if runtime == "" {
			var e error
			runtime, e = expoRuntime(dist)
			if e != nil {
				return e
			}
		}
		baseline, e := latestSourceCommit(srv, tok, ch, runtime)
		if e != nil {
			return e
		}
		src, e := provenance(ch, baseline, nonlinear)
		if e != nil {
			return e
		}
		var body bytes.Buffer
		mw := multipart.NewWriter(&body)
		b, _ := json.Marshal(map[string]any{"channel": ch, "runtime_version": runtime, "message": msg, "source": src})
		_ = mw.WriteField("request", string(b))
		part, e := mw.CreateFormFile("archive", "dist.zip")
		if e != nil {
			return e
		}
		if e = zipDir(part, dist); e != nil {
			return e
		}
		_ = mw.Close()
		req, e := http.NewRequest(http.MethodPost, strings.TrimRight(srv, "/")+"/admin/publish", &body)
		if e != nil {
			return e
		}
		req.Header.Set("Authorization", "Bearer "+tok)
		req.Header.Set("Content-Type", mw.FormDataContentType())
		res, e := http.DefaultClient.Do(req)
		if e != nil {
			return e
		}
		defer res.Body.Close()
		out, _ := io.ReadAll(res.Body)
		if res.StatusCode/100 != 2 {
			return fmt.Errorf("publish: %s: %s", res.Status, out)
		}
		return writeOutput(os.Stdout, out, jsonOutput)
	}}
	c.Flags().StringVar(&srv, "server", "", "server URL")
	c.Flags().StringVar(&tok, "token", "", "admin token")
	c.Flags().StringVar(&ch, "channel", "", "channel")
	c.Flags().StringVar(&dist, "dist", "", "expo export directory")
	c.Flags().StringVar(&msg, "message", "", "message")
	c.Flags().StringVar(&runtimeVersion, "runtime-version", "", "resolved Expo runtimeVersion; required for fingerprint policy")
	c.Flags().BoolVar(&nonlinear, "allow-nonlinear-source", false, "allow non-linear source")
	c.Flags().BoolVar(&jsonOutput, "json", false, "print JSON instead of a table")
	_ = c.MarkFlagRequired("server")
	_ = c.MarkFlagRequired("token")
	_ = c.MarkFlagRequired("channel")
	_ = c.MarkFlagRequired("dist")
	_ = c.MarkFlagRequired("message")
	return c
}
func getCmd(name, url string) *cobra.Command {
	var srv, tok string
	var jsonOutput bool
	c := &cobra.Command{Use: name, RunE: func(_ *cobra.Command, _ []string) error {
		r, e := http.NewRequest("GET", strings.TrimRight(srv, "/")+url, nil)
		if e != nil {
			return e
		}
		r.Header.Set("Authorization", "Bearer "+tok)
		res, e := http.DefaultClient.Do(r)
		if e != nil {
			return e
		}
		defer res.Body.Close()
		body, e := io.ReadAll(res.Body)
		if e != nil {
			return e
		}
		return writeOutput(os.Stdout, body, jsonOutput)
	}}
	c.Flags().StringVar(&srv, "server", "", "server URL")
	c.Flags().StringVar(&tok, "token", "", "admin token")
	c.Flags().BoolVar(&jsonOutput, "json", false, "print JSON instead of a table")
	_ = c.MarkFlagRequired("server")
	_ = c.MarkFlagRequired("token")
	return c
}
func showCmd() *cobra.Command {
	return adminGet("show <group>", func(args []string) string { return "/admin/updates/" + args[0] })
}
func channelCmd() *cobra.Command {
	c := &cobra.Command{Use: "channel"}
	c.AddCommand(adminGet("list", func([]string) string { return "/admin/channels" }), adminGet("show <channel>", func(a []string) string { return "/admin/channels/" + a[0] }), adminGet("history <channel>", func(a []string) string { return "/admin/channels/" + a[0] + "/history" }))
	return c
}
func sourceCmd() *cobra.Command {
	c := &cobra.Command{Use: "source"}
	c.AddCommand(adminGet("show <group>", func(a []string) string { return "/admin/updates/" + a[0] }), sourceFindCmd(), adminGet("compare <from> <to>", func(a []string) string { return "/admin/source/compare/" + a[0] + "/" + a[1] }))
	return c
}
func sourceFindCmd() *cobra.Command {
	var srv, tok, commit string
	var jsonOutput bool
	c := &cobra.Command{Use: "find", Args: cobra.NoArgs, RunE: func(_ *cobra.Command, _ []string) error {
		r, e := http.NewRequest(http.MethodGet, strings.TrimRight(srv, "/")+"/admin/source/"+url.PathEscape(commit), nil)
		if e != nil {
			return e
		}
		r.Header.Set("Authorization", "Bearer "+tok)
		res, e := http.DefaultClient.Do(r)
		if e != nil {
			return e
		}
		defer res.Body.Close()
		if res.StatusCode/100 != 2 {
			return fmt.Errorf("%s", res.Status)
		}
		body, e := io.ReadAll(res.Body)
		if e != nil {
			return e
		}
		return writeOutput(os.Stdout, body, jsonOutput)
	}}
	c.Flags().StringVar(&srv, "server", "", "server URL")
	c.Flags().StringVar(&tok, "token", "", "admin token")
	c.Flags().StringVar(&commit, "commit", "", "full commit SHA")
	c.Flags().BoolVar(&jsonOutput, "json", false, "print JSON instead of a table")
	for _, name := range []string{"server", "token", "commit"} {
		_ = c.MarkFlagRequired(name)
	}
	return c
}
func insightsCmd() *cobra.Command {
	c := &cobra.Command{Use: "insights"}
	c.AddCommand(
		adminGet("group <group>", func(a []string) string { return "/admin/insights?group_id=" + url.QueryEscape(a[0]) }),
		adminGet("channel <channel>", func(a []string) string { return "/admin/insights?channel=" + url.QueryEscape(a[0]) }),
	)
	return c
}
func adminGet(use string, endpoint func([]string) string) *cobra.Command {
	var srv, tok string
	var jsonOutput bool
	c := &cobra.Command{Use: use, Args: cobra.ExactArgs(strings.Count(use, "<")), RunE: func(_ *cobra.Command, args []string) error {
		r, e := http.NewRequest(http.MethodGet, strings.TrimRight(srv, "/")+endpoint(args), nil)
		if e != nil {
			return e
		}
		r.Header.Set("Authorization", "Bearer "+tok)
		res, e := http.DefaultClient.Do(r)
		if e != nil {
			return e
		}
		defer res.Body.Close()
		if res.StatusCode/100 != 2 {
			return fmt.Errorf("%s", res.Status)
		}
		body, e := io.ReadAll(res.Body)
		if e != nil {
			return e
		}
		return writeOutput(os.Stdout, body, jsonOutput)
	}}
	c.Flags().StringVar(&srv, "server", "", "server URL")
	c.Flags().StringVar(&tok, "token", "", "admin token")
	c.Flags().BoolVar(&jsonOutput, "json", false, "print JSON instead of a table")
	_ = c.MarkFlagRequired("server")
	_ = c.MarkFlagRequired("token")
	return c
}
func rollbackCmd() *cobra.Command {
	var srv, tok, ch, runtimeVersion, platform, to string
	var embedded bool
	var jsonOutput bool
	c := &cobra.Command{Use: "rollback", RunE: func(_ *cobra.Command, _ []string) error {
		mode := "ota"
		if embedded {
			mode = "embedded"
			to = ""
		}
		b, _ := json.Marshal(map[string]string{"runtime_version": runtimeVersion, "platform": platform, "mode": mode, "group_id": to})
		r, e := http.NewRequest(http.MethodPost, strings.TrimRight(srv, "/")+"/admin/channels/"+ch+"/rollback", bytes.NewReader(b))
		if e != nil {
			return e
		}
		r.Header.Set("Authorization", "Bearer "+tok)
		r.Header.Set("Content-Type", "application/json")
		res, e := http.DefaultClient.Do(r)
		if e != nil {
			return e
		}
		defer res.Body.Close()
		if res.StatusCode/100 != 2 {
			return fmt.Errorf("rollback: %s", res.Status)
		}
		body, e := io.ReadAll(res.Body)
		if e != nil {
			return e
		}
		return writeOutput(os.Stdout, body, jsonOutput)
	}}
	c.Flags().StringVar(&srv, "server", "", "server URL")
	c.Flags().StringVar(&tok, "token", "", "admin token")
	c.Flags().StringVar(&ch, "channel", "", "channel")
	c.Flags().StringVar(&runtimeVersion, "runtime-version", "", "runtime version")
	c.Flags().StringVar(&platform, "platform", "android", "platform")
	c.Flags().StringVar(&to, "to", "", "target group")
	c.Flags().BoolVar(&embedded, "embedded", false, "roll back to embedded update")
	c.Flags().BoolVar(&jsonOutput, "json", false, "print JSON instead of a table")
	for _, n := range []string{"server", "token", "channel", "runtime-version"} {
		_ = c.MarkFlagRequired(n)
	}
	return c
}
func run(args ...string) (string, error) {
	b, e := exec.Command(args[0], args[1:]...).Output()
	return strings.TrimSpace(string(b)), e
}
func latestSourceCommit(srv, tok, channel, runtime string) (string, error) {
	r, e := http.NewRequest(http.MethodGet, strings.TrimRight(srv, "/")+"/admin/source/latest?channel="+url.QueryEscape(channel)+"&runtime_version="+url.QueryEscape(runtime), nil)
	if e != nil {
		return "", e
	}
	r.Header.Set("Authorization", "Bearer "+tok)
	res, e := http.DefaultClient.Do(r)
	if e != nil {
		return "", e
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return "", fmt.Errorf("source baseline: %s", res.Status)
	}
	var out struct {
		Commit string `json:"commit_sha"`
	}
	e = json.NewDecoder(res.Body).Decode(&out)
	return out.Commit, e
}
func provenance(channel, baseline string, allow bool) (map[string]any, error) {
	if out, e := run("git", "status", "--porcelain"); e != nil || out != "" {
		return nil, fmt.Errorf("clean git worktree required")
	}
	sha, e := run("git", "rev-parse", "HEAD")
	if e != nil {
		return nil, e
	}
	tree, e := run("git", "rev-parse", "HEAD^{tree}")
	if e != nil {
		return nil, e
	}
	parent, _ := run("git", "rev-parse", "HEAD^")
	repo, _ := run("git", "config", "--get", "remote.origin.url")
	ref, _ := run("git", "branch", "--show-current")
	subject, _ := run("git", "log", "-1", "--format=%s")
	commits := []map[string]string{}
	if baseline != "" {
		if _, e := run("git", "merge-base", "--is-ancestor", baseline, sha); e != nil && !allow {
			return nil, fmt.Errorf("non-linear source range; pass --allow-nonlinear-source")
		}
		out, e := run("git", "log", "--reverse", "--format=%H%x1f%P%x1f%s%x1f%an%x1f%aI", baseline+".."+sha)
		if e != nil {
			return nil, e
		}
		for _, line := range strings.Split(out, "\n") {
			parts := strings.Split(line, "\x1f")
			if len(parts) == 5 {
				commits = append(commits, map[string]string{"sha": parts[0], "parent_sha": parts[1], "subject": parts[2], "author": parts[3], "authored_at": parts[4]})
			}
		}
	} else {
		out, e := run("git", "log", "-1", "--format=%H%x1f%P%x1f%s%x1f%an%x1f%aI", sha)
		if e != nil {
			return nil, e
		}
		parts := strings.Split(out, "\x1f")
		if len(parts) == 5 {
			commits = append(commits, map[string]string{"sha": parts[0], "parent_sha": parts[1], "subject": parts[2], "author": parts[3], "authored_at": parts[4]})
		}
	}
	githubRepo := os.Getenv("GITHUB_REPOSITORY")
	runID := os.Getenv("GITHUB_RUN_ID")
	github := map[string]string{"repository": githubRepo, "workflow": os.Getenv("GITHUB_WORKFLOW"), "run_id": runID, "run_attempt": os.Getenv("GITHUB_RUN_ATTEMPT"), "run_url": "", "actor": os.Getenv("GITHUB_ACTOR"), "ref": os.Getenv("GITHUB_REF")}
	if githubRepo != "" && runID != "" {
		github["run_url"] = "https://github.com/" + githubRepo + "/actions/runs/" + runID
	}
	return map[string]any{"commit_sha": sha, "tree_sha": tree, "parent_sha": parent, "repository": strings.TrimSuffix(repo, ".git"), "ref": ref, "subject": subject, "channel": channel, "source_mode": map[bool]string{true: "nonlinear", false: "linear"}[allow], "commits": commits, "github": github}, nil
}

func writeOutput(w io.Writer, body []byte, jsonOutput bool) error {
	if jsonOutput {
		_, err := w.Write(append(body, '\n'))
		return err
	}
	var value any
	if err := json.Unmarshal(body, &value); err != nil {
		_, writeErr := w.Write(append(body, '\n'))
		return writeErr
	}
	rows := []map[string]any{}
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			if row, ok := item.(map[string]any); ok {
				rows = append(rows, row)
			}
		}
	case map[string]any:
		rows = append(rows, typed)
	}
	if len(rows) == 0 {
		_, err := fmt.Fprintln(w, "(no results)")
		return err
	}
	columns := make(map[string]bool)
	for _, row := range rows {
		for key := range row {
			columns[key] = true
		}
	}
	header := make([]string, 0, len(columns))
	for key := range columns {
		header = append(header, key)
	}
	sort.Strings(header)
	tw := tabwriter.NewWriter(w, 0, 4, 2, ' ', 0)
	_, _ = fmt.Fprintln(tw, strings.Join(header, "\t"))
	for _, row := range rows {
		cells := make([]string, len(header))
		for i, key := range header {
			if raw, ok := row[key]; ok {
				switch v := raw.(type) {
				case string:
					cells[i] = v
				default:
					encoded, _ := json.Marshal(v)
					cells[i] = string(encoded)
				}
			}
		}
		_, _ = fmt.Fprintln(tw, strings.Join(cells, "\t"))
	}
	return tw.Flush()
}
func expoRuntime(dist string) (string, error) {
	b, e := os.ReadFile(filepath.Join(dist, "expoConfig.json"))
	if e != nil {
		return "", e
	}
	var x struct {
		RuntimeVersion any    `json:"runtimeVersion"`
		Version        string `json:"version"`
		Android        struct {
			RuntimeVersion any `json:"runtimeVersion"`
		} `json:"android"`
		IOS struct {
			RuntimeVersion any `json:"runtimeVersion"`
		} `json:"ios"`
	}
	if e = json.Unmarshal(b, &x); e != nil {
		return "", e
	}
	if s, ok := x.RuntimeVersion.(string); ok && s != "" {
		return s, nil
	}
	for _, value := range []any{x.Android.RuntimeVersion, x.IOS.RuntimeVersion} {
		if s, ok := value.(string); ok && s != "" {
			return s, nil
		}
		if policy, ok := value.(map[string]any); ok && policy["policy"] == "appVersion" && x.Version != "" {
			return x.Version, nil
		}
	}
	return "", fmt.Errorf("expoConfig.json has no resolved runtimeVersion; pass --runtime-version (for example, the hash from eas fingerprint:generate for fingerprint policy)")
}
func zipDir(w io.Writer, dir string) error {
	z := zip.NewWriter(w)
	defer z.Close()
	return filepath.WalkDir(dir, func(p string, d os.DirEntry, e error) error {
		if e != nil {
			return e
		}
		if d.IsDir() {
			return nil
		}
		rel, e := filepath.Rel(dir, p)
		if e != nil {
			return e
		}
		f, e := z.Create(filepath.ToSlash(rel))
		if e != nil {
			return e
		}
		in, e := os.Open(p)
		if e != nil {
			return e
		}
		defer in.Close()
		_, e = io.Copy(f, in)
		return e
	})
}
