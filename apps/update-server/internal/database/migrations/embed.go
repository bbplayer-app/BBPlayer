package migrations

import "embed"

// FS is the single authoritative migration source for Goose and sqlc.
//
//go:embed *.sql
var FS embed.FS
