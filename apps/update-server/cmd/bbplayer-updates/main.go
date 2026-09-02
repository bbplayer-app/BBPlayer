package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
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
		for {
			select {
			case <-patchTicker.C:
				if _, e = patchworker.RunOnce(ctx, db, s.Objects); e != nil {
					slog.Error("worker: patch run", "error", e)
				}
			case <-rollupTicker.C:
				if e = db.Queries.RollupDailyMetrics(ctx); e != nil {
					slog.Error("worker: metrics rollup", "error", e)
				}
			case <-cleanupTicker.C:
				if e = db.Queries.DeleteExpiredRawEvents(ctx); e != nil {
					slog.Error("worker: raw event cleanup", "error", e)
				}
				if e = db.Queries.DeleteExpiredServiceMetrics(ctx); e != nil {
					slog.Error("worker: service metric cleanup", "error", e)
				}
				if e = db.Queries.DeleteExpiredDeliveryMetrics(ctx); e != nil {
					slog.Error("worker: delivery metric cleanup", "error", e)
				}
			}
		}
	}}
}
