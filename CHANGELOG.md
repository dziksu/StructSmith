# Changelog

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
