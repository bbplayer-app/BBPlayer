package store

import (
	"context"
	"strings"

	"database/sql"

	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/migrations"
	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
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
	// Goose tracks applied versions in goose_db_version. The advisory lock makes
	// concurrent migrate jobs wait instead of applying the same version racefully.
	conn, err := s.Pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	const migrationLockID int64 = 624_302_041
	if _, err = conn.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationLockID); err != nil {
		return err
	}
	defer func() { _, _ = conn.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", migrationLockID) }()

	db, err := sql.Open("pgx", s.Pool.Config().ConnString())
	if err != nil {
		return err
	}
	defer db.Close()
	goose.SetBaseFS(migrations.FS)
	if err = goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.UpContext(ctx, db, ".")
}
func (s *Store) LatestSourceCommit(ctx context.Context, channel, runtime string) (string, error) {
	c, e := s.Queries.LatestSourceCommit(ctx, db.LatestSourceCommitParams{Channel: channel, RuntimeVersion: runtime})
	if e == pgx.ErrNoRows {
		return "", nil
	}
	return c, e
}
func (s *Store) Query(ctx context.Context, q string, args ...any) (pgx.Rows, error) {
	return s.Pool.Query(ctx, strings.TrimSpace(q), args...)
}
