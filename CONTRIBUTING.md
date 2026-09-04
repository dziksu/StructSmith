# Contributing to StructSmith

Thanks for taking the time. This is a small, opinionated project — the guidelines
below exist so contributions stay easy to review.

## Getting started

```bash
bun install --frozen-lockfile
bun run dev
```

The API starts on `:3000`, the Vite dev server on <http://localhost:5173>, and the
SQLite database is created and migrated on first boot. No Docker, Postgres, Redis,
Java or Python needed. `bun run stop` frees both ports if a process is left behind.

## Before opening a pull request

```bash
bun run check      # Biome: lint, formatting and import order
bun run typecheck  # tsc --noEmit across the whole monorepo
bun run test       # domain and persistence tests
bun run build      # production build of the UI
```

CI runs exactly these four, plus a Docker image build. `bun run check:fix` applies
what can be fixed automatically.

When updating dependencies, commit the regenerated `bun.lock` together with the
workspace manifests. Update `react` and `react-dom` together, and check migration
notes for major releases before running the checks above.

Update `i18next` and `react-i18next` together. Keep Zod workspace dependencies
and the root `overrides.zod` range aligned: the override prevents the MCP SDK
from resolving an older bundled Zod 4 type definition through Zod 3.25.
After changing the override, use `bun install --force --frozen-lockfile` if an
existing installation retains stale dependency links.

## Architecture rules

These are the invariants the project is built on. A change that breaks one needs a
very good reason, stated in the pull request.

1. **The semantic model is the source of truth, not the diagram.** React Flow only
   renders a view of the model. If a piece of information exists solely in React
   Flow state, it is in the wrong place — an AI client reading the model through
   MCP has to understand the architecture with the frontend removed entirely.
2. **Layout belongs to views, not to elements.** Positions live in `view_elements`,
   so one element appears on many diagrams without copies. Moving a node must never
   change the architecture.
3. **REST and MCP share one domain layer.** Neither surface may reach for SQL or
   re-implement a rule. Business logic lives in `packages/domain`; only
   `packages/database` knows Drizzle and SQLite.
4. **DTOs are defined once.** Every shape crossing a boundary comes from
   `packages/contracts`. The frontend, the REST API and the MCP tool schemas all
   derive from those Zod schemas.
5. **Mutations go through the domain services**, which own the revision guard, the
   activity log and snapshots. Write paths that bypass them break optimistic
   concurrency between a user and an AI client.

## Project layout

```
apps/web/        React UI (React Flow, TanStack Router/Query, Zustand)
apps/server/     Bun + Express: REST, MCP transport, SSE, static UI
packages/contracts/  Zod schemas and DTOs shared everywhere
packages/domain/     Pure domain: rules, validation, operations, services
packages/database/   Drizzle repositories implementing the domain ports
packages/mcp/        MCP tools, resources, prompts, Streamable HTTP handler
migrations/      Plain SQL, applied in order at startup
tests/           bun:test over the real domain and an in-memory database
```

## Database changes

Migrations are plain SQL applied in filename order by `scripts/migrate.ts`. Add a
new numbered file in `migrations/` and update `packages/database/src/schema.ts` to
match. Never edit a migration that has already shipped — the migrator is
forward-only. `bun run db:generate` can draft one from the schema with Drizzle Kit.

## Adding a language

Copy `apps/web/src/i18n/locales/en.json`, translate it, then register the file in
`apps/web/src/i18n/index.ts` and add the code to `supportedLanguages`. No user-facing
copy is hard-coded in components, so nothing else needs touching.

## Code style

Biome handles formatting and linting; there is no separate formatter. TypeScript
runs with `strict` and `noUncheckedIndexedAccess`, and `any` is a lint error. Two
accessibility rules are switched off in `biome.jsonc` with the reasoning inline —
they describe patterns this editor cannot express.

## Commits and pull requests

Use Conventional Commits, keep subjects under ~72 characters, and explain *why*
in the body when it is not obvious:

- `fix: ...` or `perf: ...` creates a patch release.
- `feat: ...` creates a minor release.
- `feat!: ...`, any other `type!: ...`, or a `BREAKING CHANGE:` footer creates a major release.
- `build(deps): ...` creates a patch release for runtime dependency updates.
- `docs: ...`, `chore: ...`, and `build(deps-dev): ...` do not release on their own.

When squash-merging, use this format in the PR title: that title becomes the
commit analyzed for release. A merge commit preserves the original commit subjects.

One logical change per pull request. Include a screenshot for anything that changes
the canvas or a panel.

## Automated releases

After both CI jobs succeed on `main`, [semantic-release](https://github.com/semantic-release/semantic-release)
analyzes commits since the last `vX.Y.Z` tag, generates release notes, and publishes
a GitHub release. With no existing release tag, the first release is `1.0.0`;
the development version in `package.json` is not the release baseline.

The same workflow then publishes multi-architecture GHCR images tagged `latest`,
`vX.Y.Z`, `vX.Y`, and `sha-…`, built from the tested commit. Release builds stamp
the version into the shared product identity, including HTTP health and MCP.
No npm packages or automatic commits to protected `main` are published. GitHub
release notes are the generated changelog; `CHANGELOG.md` remains manually maintained.

Only the built-in `GITHUB_TOKEN` is needed (contents write for releases, packages
write for images); no personal access token or branch-protection bypass is needed.
Image publication is called directly because tags/releases created with that token
do not trigger another workflow. See the [GitHub plugin documentation](https://github.com/semantic-release/github#github-authentication).

If image publication fails after the release exists, rerun the failed image job,
or rerun the full workflow for the same commit: its existing release tag is reused.
The CI workflow can also be dispatched manually on `main`. Check both release and
image jobs before announcing availability; release notes can exist before the image finishes.
New tag-protection rules must allow the Actions token to create release tags.

Node 24.10+ is required only for the release command; normal development still
uses Bun. `bun run release` deliberately refuses to publish from a local shell.
Keep the Conventional Commits preset on 9.x until the release-notes generator
supports changelog-writer 9; preset 10 requires that newer writer. The release
tests cover both version selection and generated notes to catch this mismatch.
