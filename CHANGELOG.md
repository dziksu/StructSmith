# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
