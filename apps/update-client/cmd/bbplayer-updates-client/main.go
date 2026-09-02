package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

type manifest struct {
	ID          string  `json:"id"`
	LaunchAsset asset   `json:"launchAsset"`
	Assets      []asset `json:"assets"`
}

type directive struct {
	Type string `json:"type"`
}
type asset struct {
	Key  string `json:"key"`
	Hash string `json:"hash"`
	URL  string `json:"url"`
}

func main() {
	root := &cobra.Command{Use: "bbplayer-updates-client", Short: "Protocol client and E2E probe for BBPlayer Updates"}
	root.AddCommand(checkCmd(), eventCmd())
	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}

func checkCmd() *cobra.Command {
	var server, channel, runtime, platform, downloadDir, currentUpdateID string
	cmd := &cobra.Command{Use: "check", RunE: func(_ *cobra.Command, _ []string) error {
		req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, strings.TrimRight(server, "/")+"/api/manifest", nil)
		if err != nil {
			return err
		}
		req.Header.Set("expo-platform", platform)
		req.Header.Set("expo-runtime-version", runtime)
		req.Header.Set("expo-channel-name", channel)
		req.Header.Set("expo-protocol-version", "1")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer res.Body.Close()
		if res.StatusCode == http.StatusNoContent {
			fmt.Println(`{"status":"no_update"}`)
			return nil
		}
		if res.StatusCode/100 != 2 {
			body, _ := io.ReadAll(res.Body)
			return fmt.Errorf("manifest: %s: %s", res.Status, body)
		}
		body, err := responseJSON(res)
		if err != nil {
			return err
		}
		var d directive
		if err = json.Unmarshal(body, &d); err != nil {
			return err
		}
		if d.Type != "" {
			return json.NewEncoder(os.Stdout).Encode(d)
		}
		var m manifest
		if err = json.Unmarshal(body, &m); err != nil {
			return err
		}
		if downloadDir != "" {
			all := append([]asset{m.LaunchAsset}, m.Assets...)
			seen := make(map[string]bool)
			for index, a := range all {
				if a.URL == "" || seen[a.URL] {
					continue
				}
				seen[a.URL] = true
				baseID := ""
				if index == 0 {
					baseID = currentUpdateID
				}
				if err := download(a, downloadDir, baseID); err != nil {
					return err
				}
			}
		}
		return json.NewEncoder(os.Stdout).Encode(m)
	}}
	cmd.Flags().StringVar(&server, "server", "", "update server URL")
	cmd.Flags().StringVar(&channel, "channel", "", "Expo channel")
	cmd.Flags().StringVar(&runtime, "runtime-version", "", "Expo runtimeVersion")
	cmd.Flags().StringVar(&platform, "platform", "android", "android or ios")
	cmd.Flags().StringVar(&downloadDir, "download-dir", "", "download and verify manifest assets")
	cmd.Flags().StringVar(&currentUpdateID, "current-update-id", "", "send A-IM: bsdiff for the launch asset using this installed update ID")
	for _, f := range []string{"server", "channel", "runtime-version"} {
		_ = cmd.MarkFlagRequired(f)
	}
	return cmd
}

func responseJSON(res *http.Response) ([]byte, error) {
	mediaType, params, err := mime.ParseMediaType(res.Header.Get("Content-Type"))
	if err != nil {
		return nil, err
	}
	if mediaType != "multipart/mixed" {
		return io.ReadAll(res.Body)
	}
	reader := multipart.NewReader(res.Body, params["boundary"])
	part, err := reader.NextPart()
	if err != nil {
		return nil, fmt.Errorf("directive part: %w", err)
	}
	defer part.Close()
	return io.ReadAll(part)
}

func download(a asset, dir, currentUpdateID string) error {
	req, err := http.NewRequest(http.MethodGet, a.URL, nil)
	if err != nil {
		return err
	}
	if currentUpdateID != "" {
		req.Header.Set("A-IM", "bsdiff")
		req.Header.Set("Expo-Current-Update-ID", currentUpdateID)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusIMUsed {
		return fmt.Errorf("asset %s: %s", a.Key, res.Status)
	}
	b, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}
	name := filepath.Base(a.Key)
	if res.StatusCode == http.StatusIMUsed {
		if !strings.Contains(res.Header.Get("IM"), "bsdiff") || !strings.HasPrefix(string(b), "BSDIFF40") {
			return fmt.Errorf("asset %s: invalid bsdiff response", a.Key)
		}
		name += ".bsdiff"
	} else {
		h := sha256.Sum256(b)
		if actual := base64.RawURLEncoding.EncodeToString(h[:]); actual != a.Hash {
			return fmt.Errorf("asset %s hash mismatch", a.Key)
		}
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, name), b, 0o644)
}

func eventCmd() *cobra.Command {
	var server, file string
	cmd := &cobra.Command{Use: "event", RunE: func(_ *cobra.Command, _ []string) error {
		body, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		res, err := http.Post(strings.TrimRight(server, "/")+"/api/events", "application/json", strings.NewReader(string(body)))
		if err != nil {
			return err
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusAccepted {
			return fmt.Errorf("event: %s", res.Status)
		}
		return nil
	}}
	cmd.Flags().StringVar(&server, "server", "", "update server URL")
	cmd.Flags().StringVar(&file, "file", "", "versioned event envelope JSON")
	_ = cmd.MarkFlagRequired("server")
	_ = cmd.MarkFlagRequired("file")
	return cmd
}
