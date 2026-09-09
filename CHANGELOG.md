# Changelog

## [1.7.0](https://github.com/dziksu/structsmith/compare/v1.6.2...v1.7.0) (2026-09-09)

### Features

* **layout:** add graph arrangement algorithms ([48beb2d](https://github.com/dziksu/structsmith/commit/48beb2d22d1b97d3ad358549d3a11a845e774575))
* **ui:** improve diagram presentation controls ([e0700c5](https://github.com/dziksu/structsmith/commit/e0700c5d248a7e32039ead5e94b32b98f6ef3378))

## [1.6.2](https://github.com/dziksu/structsmith/compare/v1.6.1...v1.6.2) (2026-09-08)

### Bug Fixes

* **ui:** improve dark theme ownership cues ([#42](https://github.com/dziksu/structsmith/issues/42)) ([db7f16e](https://github.com/dziksu/structsmith/commit/db7f16ed975c0f0a7c85b5bc4c1a45f781a3ba27))

## [1.6.1](https://github.com/dziksu/structsmith/compare/v1.6.0...v1.6.1) (2026-09-07)

### Bug Fixes

* **site:** prerender marketing page ([2e8788d](https://github.com/dziksu/structsmith/commit/2e8788dbb688e1d354c79a57709f4f8ef43c8cf3))

## [1.6.0](https://github.com/dziksu/structsmith/compare/v1.5.0...v1.6.0) (2026-09-07)

### Features

* **site:** add marketing site and Pages deployment ([1cb2f5f](https://github.com/dziksu/structsmith/commit/1cb2f5f60e4c26186532263ef44ca714b5fbcce7))

### Bug Fixes

* **release:** align changelog writer versions ([e8fd854](https://github.com/dziksu/structsmith/commit/e8fd854bfb7cc95c90d56dd3949c431d9268df9f))

## [1.5.0](https://github.com/dziksu/structsmith/compare/v1.4.0...v1.5.0) (2026-09-07)

### Features

* **mcp:** add AI client setup guides ([942911a](https://github.com/dziksu/structsmith/commit/942911afdabe1da86c7889f38fb52e3c4e9a1ec1))

## [1.4.0](https://github.com/dziksu/structsmith/compare/v1.3.0...v1.4.0) (2026-09-07)

### Features

* **canvas:** add relationship routing options ([11dbc12](https://github.com/dziksu/structsmith/commit/11dbc1202241922b442c9269bbdab1edd7bb89d4))

## [1.3.0](https://github.com/dziksu/structsmith/compare/v1.2.0...v1.3.0) (2026-09-07)

### Features

* **web:** redesign workspace home ([728d575](https://github.com/dziksu/structsmith/commit/728d5755db4be791ca7ded5779c9f9a9f1d3315e))

### Bug Fixes

* **editor:** restore view inspector from canvas ([3b2dda5](https://github.com/dziksu/structsmith/commit/3b2dda59d35ff9e596e834a0fed82ee13c2ea309))

## [1.2.0](https://github.com/dziksu/structsmith/compare/v1.1.1...v1.2.0) (2026-09-07)

### Features

* refresh branding and backfill changelog ([b1613d1](https://github.com/dziksu/structsmith/commit/b1613d15878e2d65ab9fd8cc62a28fbfd7459164))

## [1.1.1](https://github.com/dziksu/structsmith/compare/v1.1.0...v1.1.1) (2026-09-07)

### Bug Fixes

- **release:** align changelog writer with preset
  ([25b15fd](https://github.com/dziksu/structsmith/commit/25b15fd992c190a960eeb929c19ecdbd938b6095))

### Build and Dependencies

- **deps-dev:** bump conventional-changelog-conventionalcommits
  ([3f892f3](https://github.com/dziksu/structsmith/commit/3f892f37dd597c8223d30ec776cc840756655784))

## [1.1.0](https://github.com/dziksu/structsmith/compare/v1.0.1...v1.1.0) (2026-09-07)

### Features

- Add copyable architecture references
  ([761b806](https://github.com/dziksu/structsmith/commit/761b806d3145199192e1c7a39cd854757d353ab8))
- Add workspace editing and deletion
  ([fe0b913](https://github.com/dziksu/structsmith/commit/fe0b9131ef9ee6595951caf968e52ab713323118))
- **mcp:** add agent-first modeling workflow
  ([dd405c7](https://github.com/dziksu/structsmith/commit/dd405c7db80ee0f8c2c496397313de6548624a21))

## [1.0.1](https://github.com/dziksu/structsmith/compare/v1.0.0...v1.0.1) (2026-09-07)

### Build and Dependencies

- **deps:** bump actions/setup-node from 6 to 7
  ([33fbf1e](https://github.com/dziksu/structsmith/commit/33fbf1e9035bf8d2371a5cda48e9feef8c401e31))

## 1.0.0 (2026-09-04)

### Features

- Automate releases with semantic-release
  ([f67f42e](https://github.com/dziksu/structsmith/commit/f67f42eb738f43c16b4da9ed2b2e68930d3f8c38))

### Bug Fixes

- Migrate Zod, i18n and layout dependencies
  ([f9ee743](https://github.com/dziksu/structsmith/commit/f9ee743530e7dcfa098bab055632444ef0b05e6b))

## 0.1.0 (2026-09-04)

First public release.

### Added

- Semantic architecture model: elements, relationships, per-view layout, presales
  records and snapshots, stored in a single SQLite file
- Views that render the same element on many diagrams without copying it, with
  implied relationships lifted to the nearest visible ancestor
- Editor: custom React Flow nodes, derived boundaries, dagre auto layout, command
  palette, inspector with autosave, deterministic validation and an activity log
- REST API with a batch command endpoint, optimistic concurrency through workspace
  revisions, and Server-Sent Events for live updates
- MCP over Streamable HTTP — 31 tools, 7 resources and 6 prompt templates — sharing
  the same domain layer as REST, plus a stdio entry point
- Export to JSON, Mermaid, PNG and SVG; import of native JSON
- English and Polish UI, light/dark/system themes
- Single-container Docker image, compose file, and GitHub Actions for CI and
  multi-architecture images
