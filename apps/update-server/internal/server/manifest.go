package server

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
	"time"

	dbq "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel"
)

func (s *Server) manifest(w http.ResponseWriter, r *http.Request) {
	_, span := otel.Tracer("updates").Start(r.Context(), "manifest")
	defer span.End()
	platform, runtime, channel := r.Header.Get("expo-platform"), r.Header.Get("expo-runtime-version"), r.Header.Get("expo-channel-name")
	if platform != "android" && platform != "ios" || runtime == "" || channel == "" {
		http.Error(w, "missing Expo platform, runtime version, or channel", 400)
		return
	}
	head, err := s.DB.Queries.GetChannelHead(r.Context(), dbq.GetChannelHeadParams{Channel: channel, RuntimeVersion: runtime, Platform: platform})
	if err == pgx.ErrNoRows {
		s.recordServer(r, "manifest_no_update", nil)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		http.Error(w, "database", 500)
		return
	}
	if head.Mode == "embedded" {
		s.recordServer(r, "manifest_embedded_rollback", nil)
		s.writeDirective(w, r, map[string]any{"type": "rollBackToEmbedded"})
		return
	}
	update, err := s.DB.Queries.GetUpdateForGroupPlatform(r.Context(), dbq.GetUpdateForGroupPlatformParams{GroupID: head.GroupID, Platform: platform})
	if err != nil {
		http.Error(w, "update unavailable", 404)
		return
	}
	var launch map[string]any
	var assets []map[string]any
	rows, e := s.DB.Queries.ListAssetsForUpdate(r.Context(), update.ID)
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	for _, row := range rows {
		a := map[string]any{"key": row.AssetKey, "hash": row.Sha256, "contentType": row.ContentType, "url": s.assetURL(row.ID, row.ObjectKey, row.IsLaunch)}
		if row.IsLaunch {
			launch = a
			continue
		}
		assets = append(assets, a)
	}
	if launch == nil {
		http.Error(w, "launch asset unavailable", 404)
		return
	}
	manifest := map[string]any{"id": uuid.UUID(update.ID.Bytes), "createdAt": update.CreatedAt.Time.UTC().Format(time.RFC3339), "runtimeVersion": runtime, "launchAsset": launch, "assets": assets, "metadata": map[string]string{"channel": channel}, "extra": map[string]any{}}
	w.Header().Set("expo-protocol-version", "1")
	w.Header().Set("expo-sfv-version", "0")
	w.Header().Set("cache-control", "private, max-age=0")
	gid := uuid.UUID(head.GroupID.Bytes)
	s.recordServer(r, "manifest_served", &gid)
	s.writeManifest(w, r, manifest)
}
func (s *Server) writeDirective(w http.ResponseWriter, r *http.Request, directive any) {
	if !strings.Contains(r.Header.Get("Accept"), "multipart/mixed") {
		http.Error(w, "directive requires multipart/mixed", http.StatusNotAcceptable)
		return
	}
	body, err := json.Marshal(directive)
	if err != nil {
		http.Error(w, "directive", 500)
		return
	}
	signature := ""
	if strings.Contains(r.Header.Get("expo-expect-signature"), "sig") {
		if s.Signer == nil {
			http.Error(w, "code signing unavailable", http.StatusNotAcceptable)
			return
		}
		digest := sha256.Sum256(body)
		raw, err := rsa.SignPKCS1v15(rand.Reader, s.Signer, crypto.SHA256, digest[:])
		if err != nil {
			http.Error(w, "signature", 500)
			return
		}
		signature = fmt.Sprintf("sig=:%s:, keyid=\"%s\", alg=\"rsa-v1_5-sha256\"", base64.StdEncoding.EncodeToString(raw), s.KeyID)
	}
	boundary := multipart.NewWriter(w)
	w.Header().Set("Content-Type", "multipart/mixed; boundary="+boundary.Boundary())
	w.Header().Set("expo-protocol-version", "1")
	w.Header().Set("expo-sfv-version", "0")
	w.Header().Set("cache-control", "private, max-age=0")
	w.WriteHeader(http.StatusOK)
	header := textproto.MIMEHeader{"Content-Disposition": {`form-data; name="directive"`}, "Content-Type": {"application/json"}}
	if signature != "" {
		header.Set("expo-signature", signature)
	}
	part, err := boundary.CreatePart(header)
	if err == nil {
		_, _ = part.Write(body)
	}
	_ = boundary.Close()
}
func (s *Server) writeManifest(w http.ResponseWriter, r *http.Request, manifest any) {
	body, err := json.Marshal(manifest)
	if err != nil {
		http.Error(w, "manifest", 500)
		return
	}
	if strings.Contains(r.Header.Get("expo-expect-signature"), "sig") {
		if s.Signer == nil {
			http.Error(w, "code signing unavailable", http.StatusNotAcceptable)
			return
		}
		digest := sha256.Sum256(body)
		signature, err := rsa.SignPKCS1v15(rand.Reader, s.Signer, crypto.SHA256, digest[:])
		if err != nil {
			http.Error(w, "signature", 500)
			return
		}
		w.Header().Set("expo-signature", fmt.Sprintf("sig=:%s:, keyid=\"%s\", alg=\"rsa-v1_5-sha256\"", base64.StdEncoding.EncodeToString(signature), s.KeyID))
	}
	w.Header().Set("Content-Type", "application/expo+json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}
func (s *Server) assetURL(assetID int64, objectKey string, isLaunch bool) string {
	// expo-updates supplies the bsdiff base update only while fetching the launch
	// asset. Keep that one URL dynamic; every ordinary resource bypasses Go and
	// is fetched directly from R2's immutable custom domain.
	if s.C.R2PublicBaseURL != "" && !isLaunch {
		return s.C.R2PublicBaseURL + "/" + objectKey
	}
	return fmt.Sprintf("%s/api/assets/%d", s.C.PublicBaseURL, assetID)
}
