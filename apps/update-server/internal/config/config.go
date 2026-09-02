package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL, R2Bucket, R2AccountID, R2AccessKeyID, R2SecretAccessKey, R2Endpoint string
	PublicBaseURL, R2PublicBaseURL                                                   string
	AdminToken, InstallationHMACKey, CodeSigningPrivateKey, CodeSigningKeyID         string
}

func Load() (Config, error) {
	c := Config{DatabaseURL: os.Getenv("DATABASE_URL"), R2Bucket: os.Getenv("R2_BUCKET"), R2AccountID: os.Getenv("R2_ACCOUNT_ID"), R2AccessKeyID: os.Getenv("R2_ACCESS_KEY_ID"), R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"), R2Endpoint: strings.TrimRight(os.Getenv("R2_ENDPOINT"), "/"), PublicBaseURL: strings.TrimRight(os.Getenv("PUBLIC_BASE_URL"), "/"), R2PublicBaseURL: strings.TrimRight(os.Getenv("R2_PUBLIC_BASE_URL"), "/"), AdminToken: os.Getenv("ADMIN_TOKEN"), InstallationHMACKey: os.Getenv("INSTALLATION_HMAC_KEY"), CodeSigningPrivateKey: os.Getenv("CODE_SIGNING_PRIVATE_KEY"), CodeSigningKeyID: os.Getenv("CODE_SIGNING_KEY_ID")}
	for k, v := range map[string]string{"DATABASE_URL": c.DatabaseURL, "R2_BUCKET": c.R2Bucket, "R2_ACCOUNT_ID": c.R2AccountID, "R2_ACCESS_KEY_ID": c.R2AccessKeyID, "R2_SECRET_ACCESS_KEY": c.R2SecretAccessKey, "R2_PUBLIC_BASE_URL": c.R2PublicBaseURL, "PUBLIC_BASE_URL": c.PublicBaseURL, "ADMIN_TOKEN": c.AdminToken, "INSTALLATION_HMAC_KEY": c.InstallationHMACKey} {
		if v == "" {
			return c, fmt.Errorf("%s is required", k)
		}
	}
	if c.CodeSigningPrivateKey != "" && c.CodeSigningKeyID == "" {
		return c, fmt.Errorf("CODE_SIGNING_KEY_ID is required when CODE_SIGNING_PRIVATE_KEY is set")
	}
	return c, nil
}

// DatabaseURL returns the only setting needed by the migration command. Keeping
// this separate lets a one-shot migration job run without R2 or API credentials.
func DatabaseURL() (string, error) {
	value := os.Getenv("DATABASE_URL")
	if value == "" {
		return "", fmt.Errorf("DATABASE_URL is required")
	}
	return value, nil
}
