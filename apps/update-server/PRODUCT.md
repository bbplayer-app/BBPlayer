# BBPlayer OTA

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

BBPlayer maintainers operating the self-hosted OTA update service. They need to inspect update health, channels, runtimes, update groups, platform artifacts, and client activity without using the lower-level CLI for routine observation.

## Product Purpose

Provide a responsive, read-oriented administrative WebUI for understanding what is currently deployed and how OTA updates are behaving.

## Operating Context

The UI is served separately from the Go API during development and consumes authenticated `/admin/*` endpoints. It complements the existing TypeScript management CLI; unsupported write operations remain in the CLI.

## Capabilities and Constraints

- Overview summarizes service and update activity from existing dashboard, insight, and metric endpoints.
- Channels, update groups, and runtimes have separate list and detail pages.
- Expo's OTA information architecture is a reference, but BBPlayer-only concepts and data are authoritative. Branches, builds, and deployments are not part of this UI.
- The frontend uses React Query for network state and document navigations between pages rather than a client-side SPA router.
- Components, data tables, and charts use shadcn components installed through its CLI.

## Brand Commitments

The product name is “BBPlayer OTA”. The sidebar header uses the existing BBPlayer app icon from `apps/mobile/assets/images/icon.png`. The UI uses shadcn's semantic theme without a bespoke palette.

## Evidence on Hand

- Existing admin API contracts under `internal/server`.
- Existing WebUI scaffold under `web`.
- BBPlayer application artwork under `apps/mobile/assets/images`.
- Expo's authenticated Channels, Update groups, and Runtimes screens as an interaction and information-architecture reference.

## Product Principles

- Make the current OTA state scannable before exposing detail.
- Preserve operational truth and never imply unsupported actions.
- Keep identifiers, versions, channels, platforms, and time relationships easy to trace.
- Make loading, empty, and error states explicit at every page size.
