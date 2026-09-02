package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	db "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	limit, offset := 10, 0
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 {
		if n > 100 {
			n = 100
		}
		limit = n
	}
	if n, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && n >= 0 {
		offset = n
	}
	rows, err := s.DB.Queries.ListUpdateGroups(r.Context(), db.ListUpdateGroupsParams{Limit: int32(limit), Offset: int32(offset)})
	if err != nil {
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		var fingerprintHash *string
		if row.FingerprintHash.Valid {
			fingerprintHash = &row.FingerprintHash.String
		}
		out = append(out, map[string]any{"id": uuid.UUID(row.ID.Bytes), "channel": row.Channel, "runtime_version": row.RuntimeVersion, "message": row.Message, "created_at": row.CreatedAt.Time, "source": json.RawMessage(row.Source), "fingerprint_hash": fingerprintHash})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) show(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	group, err := s.DB.Queries.GetUpdateGroup(r.Context(), pgtype.UUID{Bytes: [16]byte(id), Valid: true})
	if err == pgx.ErrNoRows {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "database", http.StatusInternalServerError)
		return
	}
	var fingerprintHash *string
	if group.FingerprintHash.Valid {
		fingerprintHash = &group.FingerprintHash.String
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "channel": group.Channel, "runtime_version": group.RuntimeVersion, "message": group.Message, "created_at": group.CreatedAt.Time, "source": json.RawMessage(group.Source), "fingerprint": map[string]any{"hash": fingerprintHash, "sources": json.RawMessage(group.FingerprintSources)}})
}
