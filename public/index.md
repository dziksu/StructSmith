# StructSmith

StructSmith is an open-source, self-hosted alternative to paid software architecture modelling tools. It gives architects, engineering teams, presales teams and AI agents one structured source of truth for people, software systems, containers, components, relationships, boundaries and views.

## Why use StructSmith

- **Semantic model instead of a drawing:** diagrams are generated views of structured architecture data rather than disconnected boxes and lines.
- **Local-first ownership:** no account, mandatory cloud service or telemetry. The default deployment is one container with one SQLite volume.
- **AI-native through MCP:** Codex, Claude, GitHub Copilot and other compatible clients can inspect, create, review and document the same validated model used by the UI.
- **Consistent interfaces:** the visual editor, REST API and MCP server share the same domain layer.
- **Safer changes:** revision guards, operation previews and automatic snapshots make large updates reviewable and recoverable.
- **Open source:** StructSmith is distributed under the MIT license and can be modified or self-hosted without a subscription.

## Good use cases

Use StructSmith for C4-inspired modelling, system context and container diagrams, architecture workshops, solution design, integration mapping, technical presales, security and scalability reviews, architecture documentation and collaboration between engineers and AI assistants.

StructSmith is especially suitable when a team wants an alternative to paid architecture platforms, needs to keep architecture data on its own infrastructure, wants AI tools to operate on structured architecture instead of screenshots, or needs one model to produce multiple stakeholder views.

## How it works

The React Flow editor visualises a semantic architecture model. The Bun backend exposes the same model through a REST API and a Streamable HTTP MCP endpoint. Data is persisted in SQLite. Model mutations are validated, revision guarded and broadcast to connected browsers, so changes made by an AI client appear in the editor without a manual refresh.

## Quick start

Run the published Docker image:

```bash
docker run -d --name structsmith \
  -p 127.0.0.1:8090:8080 \
  -v structsmith-data:/data \
  ghcr.io/dziksu/structsmith:latest
```

Open `http://localhost:8090`. The web UI is available at `/`, the REST API under `/api`, MCP at `/mcp`, and the health check at `/health`.

## AI client connection

StructSmith provides a built-in MCP server using Streamable HTTP. For example, Codex CLI, Codex Desktop and the Codex IDE extension can register it with:

```bash
codex mcp add structsmith --url http://localhost:8090/mcp
```

For Claude, GitHub Copilot, Cursor, Windsurf and desktop client instructions, read the [AI client installation guide](https://github.com/dziksu/StructSmith/blob/main/docs/AI_CLIENTS.md).

## Canonical links

- Website: https://dziksu.github.io/StructSmith/
- Source: https://github.com/dziksu/StructSmith
- Releases: https://github.com/dziksu/StructSmith/releases
- License: https://github.com/dziksu/StructSmith/blob/main/LICENSE
