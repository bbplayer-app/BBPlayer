package server

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
)

const adminSecurityScheme = "adminBearer"

func configureAdminOpenAPI(api huma.API) {
	if api.OpenAPI().Components.SecuritySchemes == nil {
		api.OpenAPI().Components.SecuritySchemes = map[string]*huma.SecurityScheme{}
	}
	api.OpenAPI().Components.SecuritySchemes[adminSecurityScheme] = &huma.SecurityScheme{
		Type:         "http",
		Scheme:       "bearer",
		BearerFormat: "Admin token",
		Description:  "Set `Authorization: Bearer <ADMIN_TOKEN>`.",
	}
	api.OpenAPI().Tags = []*huma.Tag{
		{Name: "Updates", Description: "Published Expo update groups."},
		{Name: "Channels", Description: "Channel heads and rollback history."},
		{Name: "Source", Description: "Git provenance for published updates."},
		{Name: "Insights", Description: "Client activity and update lifecycle metrics."},
		{Name: "Metrics", Description: "Service and update-delivery metrics."},
	}
}

func registerAdminRoutes(s *Server, r chi.Router) {
	r.Group(func(a chi.Router) {
		a.Use(s.admin)
		config := huma.DefaultConfig("BBPlayer Update Server Admin API", "1.0.0")
		config.OpenAPIPath = "/admin/openapi"
		config.DocsPath = "/admin/docs"
		config.DocsRenderer = huma.DocsRendererScalar
		api := humachi.New(a, config)
		configureAdminOpenAPI(api)

		registerAdminPublishRoute(s, api)
		registerAdminUpdateRoutes(s, api)
		registerAdminChannelRoutes(s, api)
		registerAdminSourceRoutes(s, api)
		registerAdminInsightsSummaryRoute(s, api)
		registerAdminInsightRoutes(s, api)
		registerAdminMetricRoutes(s, api)
	})
}
