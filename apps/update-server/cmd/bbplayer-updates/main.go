package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
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
	// This binary is deployment infrastructure only. Developer-facing update
	// operations live in apps/hot-update-cli.
	root.AddCommand(apiCmd(), migrateCmd(), workerCmd())
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
