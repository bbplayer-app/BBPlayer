package server

import (
	"context"
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/config"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/objectstore"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
)

type Server struct {
	C       config.Config
	DB      *store.Store
	Objects objectstore.Store
	Log     *slog.Logger
	Signer  *rsa.PrivateKey
	KeyID   string
	Metrics *metrics
}
type metrics struct {
	registry *prometheus.Registry
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
}

func newMetrics() *metrics {
	r := prometheus.NewRegistry()
	m := &metrics{registry: r, requests: prometheus.NewCounterVec(prometheus.CounterOpts{Name: "bbplayer_updates_http_requests_total", Help: "Update service responses"}, []string{"route", "status"}), duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "bbplayer_updates_http_duration_seconds", Help: "Update service request durations"}, []string{"route"})}
	r.MustRegister(m.requests, m.duration)
	return m
}

func New(ctx context.Context, c config.Config, db *store.Store) (*Server, error) {
	endpoint := c.R2Endpoint
	if endpoint == "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", c.R2AccountID)
	}
	cfg, e := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion("auto"), awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(c.R2AccessKeyID, c.R2SecretAccessKey, "")), awsconfig.WithBaseEndpoint(endpoint))
	if e != nil {
		return nil, e
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) { o.UsePathStyle = c.R2Endpoint != "" })
	s := NewWithObjectStore(c, db, objectstore.NewR2(client, c.R2Bucket))
	if c.CodeSigningPrivateKey != "" {
		key, err := parseSigningKey(c.CodeSigningPrivateKey)
		if err != nil {
			return nil, err
		}
		s.Signer, s.KeyID = key, c.CodeSigningKeyID
	}
	return s, nil
}
func NewWithObjectStore(c config.Config, db *store.Store, objects objectstore.Store) *Server {
	return &Server{C: c, DB: db, Objects: objects, Log: slog.Default(), Metrics: newMetrics()}
}
func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(s.instrument)
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	r.Handle("/metrics", promhttp.HandlerFor(s.Metrics.registry, promhttp.HandlerOpts{}))
	r.Get("/api/manifest", s.manifest)
	r.Get("/api/assets/{assetID}", s.asset)
	r.Post("/api/events", s.event)
	r.Group(func(a chi.Router) {
		a.Use(s.admin)
		a.Post("/admin/publish", s.publish)
		a.Get("/admin/updates", s.list)
		a.Get("/admin/updates/{id}", s.show)
		a.Get("/admin/channels", s.channels)
		a.Get("/admin/channels/{channel}", s.channel)
		a.Post("/admin/channels/{channel}/rollback", s.rollback)
		a.Get("/admin/channels/{channel}/history", s.history)
		a.Get("/admin/source/latest", s.sourceLatest)
		a.Get("/admin/source/compare/{from}/{to}", s.sourceCompare)
		a.Get("/admin/source/{commit}", s.sourceFind)
		a.Get("/admin/insights", s.insights)
	})
	return r
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(b)
}
func (s *Server) instrument(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		wrapped := &statusWriter{ResponseWriter: w}
		next.ServeHTTP(wrapped, r)
		route := r.URL.Path
		if contextRoute := chi.RouteContext(r.Context()).RoutePattern(); contextRoute != "" {
			route = contextRoute
		}
		if wrapped.status == 0 {
			wrapped.status = http.StatusOK
		}
		s.Metrics.requests.WithLabelValues(route, fmt.Sprint(wrapped.status)).Inc()
		s.Metrics.duration.WithLabelValues(route).Observe(time.Since(started).Seconds())
	})
}
func (s *Server) admin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !hmac.Equal([]byte(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")), []byte(s.C.AdminToken)) {
			http.Error(w, "unauthorized", 401)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func (s *Server) manifest(w http.ResponseWriter, r *http.Request) {
	_, span := otel.Tracer("updates").Start(r.Context(), "manifest")
	defer span.End()
	platform, runtime, channel := r.Header.Get("expo-platform"), r.Header.Get("expo-runtime-version"), r.Header.Get("expo-channel-name")
	if platform != "android" && platform != "ios" || runtime == "" || channel == "" {
		http.Error(w, "missing Expo platform, runtime version, or channel", 400)
		return
	}
	var mode string
	var gid uuid.UUID
	err := s.DB.Pool.QueryRow(r.Context(), "SELECT mode,group_id FROM channel_heads WHERE channel=$1 AND runtime_version=$2 AND platform=$3", channel, runtime, platform).Scan(&mode, &gid)
	if err == pgx.ErrNoRows {
		s.recordServer(r, "manifest_no_update", nil)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		http.Error(w, "database", 500)
		return
	}
	if mode == "embedded" {
		s.recordServer(r, "manifest_embedded_rollback", nil)
		s.writeDirective(w, r, map[string]any{"type": "rollBackToEmbedded"})
		return
	}
	var uid uuid.UUID
	var launchKey, launchHash string
	var created time.Time
	err = s.DB.Pool.QueryRow(r.Context(), "SELECT u.id,u.launch_key,u.launch_hash,g.created_at FROM updates u JOIN update_groups g ON g.id=u.group_id WHERE u.group_id=$1 AND u.platform=$2", gid, platform).Scan(&uid, &launchKey, &launchHash, &created)
	if err != nil {
		http.Error(w, "update unavailable", 404)
		return
	}
	var launch map[string]any
	var assets []map[string]any
	rows, e := s.DB.Query(r.Context(), "SELECT id,asset_key,object_key,sha256,content_type,is_launch FROM assets WHERE update_id=$1 ORDER BY is_launch DESC,id", uid)
	if e != nil {
		http.Error(w, "database", 500)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var assetID int64
		var key, object, hash, ct string
		var isLaunch bool
		if e = rows.Scan(&assetID, &key, &object, &hash, &ct, &isLaunch); e != nil {
			http.Error(w, "database", 500)
			return
		}
		a := map[string]any{"key": key, "hash": hash, "contentType": ct, "url": s.assetURL(assetID, object, isLaunch)}
		if isLaunch {
			launch = a
			continue
		}
		assets = append(assets, a)
	}
	if launch == nil {
		http.Error(w, "launch asset unavailable", 404)
		return
	}
	manifest := map[string]any{"id": uid, "createdAt": created.UTC().Format(time.RFC3339), "runtimeVersion": runtime, "launchAsset": launch, "assets": assets, "metadata": map[string]string{"channel": channel}, "extra": map[string]any{}}
	w.Header().Set("expo-protocol-version", "1")
	w.Header().Set("expo-sfv-version", "0")
	w.Header().Set("cache-control", "private, max-age=0")
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

func parseSigningKey(value string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(strings.ReplaceAll(value, `\n`, "\n")))
	if block == nil {
		return nil, fmt.Errorf("CODE_SIGNING_PRIVATE_KEY is not PEM")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("CODE_SIGNING_PRIVATE_KEY is not RSA")
	}
	return rsaKey, nil
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
func (s *Server) asset(w http.ResponseWriter, r *http.Request) {
	assetID := chi.URLParam(r, "assetID")
	var object, ct string
	var targetSize int64
	var assetPlatform, assetRuntime, assetChannel string
	var gid uuid.UUID
	var targetUpdateID uuid.UUID
	var launch bool
	e := s.DB.Pool.QueryRow(r.Context(), "SELECT a.object_key,a.content_type,a.size_bytes,u.group_id,u.id,a.is_launch,u.platform,g.runtime_version,g.channel FROM assets a JOIN updates u ON u.id=a.update_id JOIN update_groups g ON g.id=u.group_id WHERE a.id=$1", assetID).Scan(&object, &ct, &targetSize, &gid, &targetUpdateID, &launch, &assetPlatform, &assetRuntime, &assetChannel)
	if e != nil {
		http.NotFound(w, r)
		return
	}
	if launch && strings.Contains(r.Header.Get("A-IM"), "bsdiff") {
		base, parseErr := uuid.Parse(r.Header.Get("Expo-Current-Update-ID"))
		if parseErr == nil {
			var patchKey string
			err := s.DB.Pool.QueryRow(r.Context(), "SELECT object_key FROM patches WHERE from_update_id=$1 AND to_update_id=$2 AND status='ready'", base, targetUpdateID).Scan(&patchKey)
			if err == nil {
				if served, size := s.writeObjectStatus(w, r, patchKey, "application/octet-stream", http.StatusIMUsed, map[string]string{"IM": "bsdiff", "expo-base-update-id": base.String()}); served {
					_, _ = s.DB.Pool.Exec(r.Context(), "UPDATE patches SET served_count=served_count+1 WHERE from_update_id=$1 AND to_update_id=$2", base, targetUpdateID)
					s.recordServerPayloadContext(r.Context(), "patch_served", &gid, assetPlatform, assetRuntime, assetChannel, map[string]any{"bytes": size, "target_bytes": targetSize, "base_update_id": base.String()})
					return
				}
				s.recordServerPayloadContext(r.Context(), "patch_object_error", &gid, assetPlatform, assetRuntime, assetChannel, map[string]any{"base_update_id": base.String()})
				return
			}
		}
		s.recordServerPayloadContext(r.Context(), "patch_fallback_full", &gid, assetPlatform, assetRuntime, assetChannel, map[string]any{"reason": "not_ready_or_invalid_base"})
	}
	served, size := s.writeObjectStatus(w, r, object, ct, http.StatusOK, nil)
	if served {
		s.recordServerPayloadContext(r.Context(), "asset_served", &gid, assetPlatform, assetRuntime, assetChannel, map[string]any{"bytes": size, "launch": launch})
	} else {
		s.recordServerPayloadContext(r.Context(), "asset_object_error", &gid, assetPlatform, assetRuntime, assetChannel, map[string]any{"launch": launch})
	}
}

func (s *Server) writeObject(w http.ResponseWriter, r *http.Request, object, ct string) bool {
	served, _ := s.writeObjectStatus(w, r, object, ct, http.StatusOK, nil)
	return served
}

func (s *Server) writeObjectStatus(w http.ResponseWriter, r *http.Request, object, ct string, status int, headers map[string]string) (bool, int64) {
	body, storedContentType, e := s.Objects.Get(r.Context(), object)
	if e != nil {
		http.Error(w, "asset unavailable", 502)
		return false, 0
	}
	defer body.Close()
	if storedContentType != "" {
		ct = storedContentType
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	for key, value := range headers {
		w.Header().Set(key, value)
	}
	w.WriteHeader(status)
	n, _ := io.Copy(w, body)
	return true, n
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

type Event struct {
	ID                     uuid.UUID      `json:"event_id"`
	Schema                 int            `json:"schema_version"`
	Type                   string         `json:"event_type"`
	Occurred               time.Time      `json:"occurred_at"`
	Installation           string         `json:"installation_id"`
	ClientVersion          string         `json:"client_version"`
	ClientBuild            string         `json:"client_build_version"`
	ExpoUpdatesVersion     string         `json:"expo_updates_version"`
	UpdatesProtocolVersion string         `json:"updates_protocol_version"`
	Platform               string         `json:"platform"`
	Runtime                string         `json:"runtime_version"`
	Channel                string         `json:"channel"`
	UpdateID               *uuid.UUID     `json:"launched_update_id"`
	EmbeddedUpdateID       *uuid.UUID     `json:"embedded_update_id"`
	GroupID                *uuid.UUID     `json:"update_group_id"`
	LaunchSource           string         `json:"launch_source"`
	Payload                map[string]any `json:"payload"`
}

func (s *Server) event(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
	if err != nil {
		http.Error(w, "event too large", http.StatusRequestEntityTooLarge)
		return
	}
	var fields map[string]json.RawMessage
	var e Event
	mandatory := []string{"schema_version", "event_id", "event_type", "occurred_at", "installation_id", "client_version", "client_build_version", "expo_updates_version", "updates_protocol_version", "platform", "runtime_version", "channel", "launched_update_id", "embedded_update_id", "update_group_id", "launch_source"}
	if json.Unmarshal(body, &fields) != nil || json.Unmarshal(body, &e) != nil || e.Schema != 1 || e.ID == uuid.Nil || e.Type == "" || e.Occurred.IsZero() || e.Installation == "" || e.ClientVersion == "" || e.ClientBuild == "" || e.ExpoUpdatesVersion == "" || e.UpdatesProtocolVersion == "" || e.Platform == "" || e.Runtime == "" || e.Channel == "" || e.LaunchSource == "" {
		http.Error(w, "invalid event schema v1", 400)
		return
	}
	for _, name := range mandatory {
		if _, ok := fields[name]; !ok {
			http.Error(w, "invalid event schema v1", 400)
			return
		}
	}
	m := hmac.New(sha256.New, []byte(s.C.InstallationHMACKey))
	_, _ = m.Write([]byte(e.Installation))
	installation := base64.RawURLEncoding.EncodeToString(m.Sum(nil))
	p, _ := json.Marshal(e.Payload)
	_, err = s.DB.Pool.Exec(r.Context(), "INSERT INTO update_events(id,schema_version,event_type,occurred_at,installation_hmac,client_version,client_build_version,expo_updates_version,updates_protocol_version,platform,runtime_version,channel,update_id,embedded_update_id,group_id,launch_source,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT(id) DO NOTHING", e.ID, e.Schema, e.Type, e.Occurred, installation, e.ClientVersion, e.ClientBuild, e.ExpoUpdatesVersion, e.UpdatesProtocolVersion, e.Platform, e.Runtime, e.Channel, e.UpdateID, e.EmbeddedUpdateID, e.GroupID, e.LaunchSource, p)
	if err != nil {
		http.Error(w, "database", 500)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}
func (s *Server) recordServer(r *http.Request, typ string, gid *uuid.UUID) {
	s.recordServerPayload(r, typ, gid, map[string]any{})
}

func (s *Server) recordServerPayload(r *http.Request, typ string, gid *uuid.UUID, payload map[string]any) {
	s.recordServerPayloadContext(r.Context(), typ, gid, r.Header.Get("expo-platform"), r.Header.Get("expo-runtime-version"), r.Header.Get("expo-channel-name"), payload)
}

func (s *Server) recordServerPayloadContext(ctx context.Context, typ string, gid *uuid.UUID, platform, runtime, channel string, payload map[string]any) {
	p, err := json.Marshal(payload)
	if err != nil {
		return
	}
	_, _ = s.DB.Pool.Exec(ctx, "INSERT INTO update_events(id,schema_version,event_type,occurred_at,platform,runtime_version,channel,group_id,payload) VALUES(gen_random_uuid(),1,$1,now(),$2,$3,$4,$5,$6)", typ, platform, runtime, channel, gid, p)
}
