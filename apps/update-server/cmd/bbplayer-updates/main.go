package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/config"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/patchworker"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/server"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/store"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{Use: "bbplayer-updates"}
	root.AddCommand(apiCmd(), migrateCmd(), workerCmd())
	if e := root.Execute(); e != nil {
		slog.Error("command failed", "error", e)
		os.Exit(1)
	}
}

// initLogging installs a text logger on stderr at the configured level. It
// must run before any package builds loggers, so Server.Log keeps tracking
// the process-wide default.
func initLogging(level string) {
	var l slog.Level
	switch strings.ToLower(level) {
	case "debug":
		l = slog.LevelDebug
	case "warn":
		l = slog.LevelWarn
	case "error":
		l = slog.LevelError
	default:
		l = slog.LevelInfo
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: l})))
}

func runtime(ctx context.Context) (*server.Server, *store.Store, error) {
	c, e := config.Load()
	if e != nil {
		return nil, nil, e
	}
	initLogging(c.LogLevel)
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
		slog.Info("api server listening", "addr", ":8080")
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
		slog.Info("migrations starting")
		return db.Migrate(context.Background())
	}}
}
func workerCmd() *cobra.Command {
	return &cobra.Command{Use: "worker", RunE: func(_ *cobra.Command, _ []string) error {
		ctx := context.Background()
		s, db, e := runtime(ctx)
		if e != nil {
			return e
		}
		defer db.Close()
		patchTicker := time.NewTicker(15 * time.Second)
		defer patchTicker.Stop()
		rollupTicker := time.NewTicker(5 * time.Minute)
		defer rollupTicker.Stop()
		cleanupTicker := time.NewTicker(24 * time.Hour)
		defer cleanupTicker.Stop()
		slog.Info("worker started", "patch_interval", "15s", "rollup_interval", "5m", "cleanup_interval", "24h")
		for {
			select {
			case <-patchTicker.C:
				if _, e = patchworker.RunOnce(ctx, s.Log, db, s.Objects); e != nil {
					slog.Error("worker: patch run", "error", e)
				}
			case <-rollupTicker.C:
				if e = db.Queries.RollupDailyMetrics(ctx); e != nil {
					slog.Error("worker: metrics rollup", "error", e)
				} else {
					slog.Info("worker: metrics rollup completed")
				}
			case <-cleanupTicker.C:
				started := time.Now()
				var firstErr error
				if e = db.Queries.DeleteExpiredRawEvents(ctx); e != nil && firstErr == nil {
					firstErr = e
				}
				if e = db.Queries.DeleteExpiredServiceMetrics(ctx); e != nil && firstErr == nil {
					firstErr = e
				}
				if e = db.Queries.DeleteExpiredDeliveryMetrics(ctx); e != nil && firstErr == nil {
					firstErr = e
				}
				if firstErr != nil {
					slog.Error("worker: retention cleanup", "error", firstErr, "duration_ms", time.Since(started).Milliseconds())
				} else {
					slog.Info("worker: retention cleanup completed", "duration_ms", time.Since(started).Milliseconds())
				}
			}
		}
	}}
}
