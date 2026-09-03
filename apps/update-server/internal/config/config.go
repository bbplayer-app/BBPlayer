package config

import (
	"errors"
	"os"
	"strings"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	DatabaseURL           string `env:"DATABASE_URL,required,notEmpty"`
	R2Bucket              string `env:"R2_BUCKET,required,notEmpty"`
	R2AccountID           string `env:"R2_ACCOUNT_ID,required,notEmpty"`
	R2AccessKeyID         string `env:"R2_ACCESS_KEY_ID,required,notEmpty"`
	R2SecretAccessKey     string `env:"R2_SECRET_ACCESS_KEY,required,notEmpty"`
	R2Endpoint            string `env:"R2_ENDPOINT"`
	PublicBaseURL         string `env:"PUBLIC_BASE_URL,required,notEmpty"`
	R2PublicBaseURL       string `env:"R2_PUBLIC_BASE_URL,required,notEmpty"`
	AdminToken            string `env:"ADMIN_TOKEN,required,notEmpty"`
	InstallationHMACKey   string `env:"INSTALLATION_HMAC_KEY,required,notEmpty"`
	CodeSigningPrivateKey string `env:"CODE_SIGNING_PRIVATE_KEY"`
	CodeSigningKeyID      string `env:"CODE_SIGNING_KEY_ID"`
	LogLevel              string `env:"LOG_LEVEL"`
}

func Load() (Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return c, err
	}
	if c.LogLevel == "" {
		c.LogLevel = "info"
	}
	c.R2Endpoint = strings.TrimRight(c.R2Endpoint, "/")
	c.PublicBaseURL = strings.TrimRight(c.PublicBaseURL, "/")
	c.R2PublicBaseURL = strings.TrimRight(c.R2PublicBaseURL, "/")
	if c.CodeSigningPrivateKey != "" && c.CodeSigningKeyID == "" {
		return c, errors.New("CODE_SIGNING_KEY_ID is required when CODE_SIGNING_PRIVATE_KEY is set")
	}
	return c, nil
}

// DatabaseURL returns the only setting needed by the migration command. Keeping
// this separate lets a one-shot migration job run without R2 or API credentials.
func DatabaseURL() (string, error) {
	value := os.Getenv("DATABASE_URL")
	if value == "" {
		return "", errors.New("DATABASE_URL is required")
	}
	return value, nil
}
