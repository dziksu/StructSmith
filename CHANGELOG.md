# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Upgrade React and React DOM together to 19.2.8, Express to 5.2.1, Sonner to
  2.0.8, and react-resizable-panels to 4.12.3; regenerate the Bun lockfile
- Upgrade the development toolchain, including Vite 8 and TypeScript 7

### Fixed

- Adapt the editor to the new panel API while preserving percentage-based sizes
- Update Express route parameter validation and TypeScript path/CSS declarations
- Report HTTP listen errors and exit unsuccessfully when the server cannot bind
  its port under Express 5
- Use Bun-aware Dependabot updates and group React/React DOM and Express/type
  packages so dependency updates include the lockfile and compatible pairs
- Correct public setup instructions and the Compose image name, include the
  license in the container, and exclude local environment files and databases
  from Git and Docker build contexts

## [0.1.0] - 2026-09-04

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

[Unreleased]: https://github.com/dziksu/structsmith/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/dziksu/structsmith/releases/tag/v0.1.0
