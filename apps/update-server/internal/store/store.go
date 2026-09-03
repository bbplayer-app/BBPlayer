package store

import (
	"context"
	"log/slog"
	"strings"

	"database/sql"

	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/migrations"
	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

type Store struct {
	Pool    *pgxpool.Pool
	Queries *db.Queries
}

func Open(ctx context.Context, url string) (*Store, error) {
	p, e := pgxpool.New(ctx, url)
	if e != nil {
		return nil, e
	}
	return &Store{Pool: p, Queries: db.New(p)}, p.Ping(ctx)
}
func (s *Store) Close() { s.Pool.Close() }
func (s *Store) Migrate(ctx context.Context) error {
	_db, err := sql.Open("pgx", s.Pool.Config().ConnString())
	if err != nil {
		return err
	}
	defer _db.Close()
	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return err
	}
	//goland:noinspection GoResourceLeak
	provider, err := goose.NewProvider(goose.DialectPostgres, _db, migrations.FS, goose.WithSessionLocker(locker))
	if err != nil {
		return err
	}
	applied, err := provider.Up(ctx)
	for _, r := range applied {
		if r.Source != nil {
			slog.Info("migration applied", "version", r.Source.Version, "source", r.Source.Path, "duration_ms", r.Duration.Milliseconds())
		}
	}
	return err
}
func (s *Store) Query(ctx context.Context, q string, args ...any) (pgx.Rows, error) {
	return s.Pool.Query(ctx, strings.TrimSpace(q), args...)
}
