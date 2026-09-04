## What and why

<!-- What changes, and what problem it solves. Link an issue if there is one. -->

## How to verify

<!-- The steps a reviewer should follow. Include a screenshot for canvas or panel changes. -->

## Checklist

- [ ] `bun run check`, `bun run typecheck`, `bun run test` and `bun run build` pass
- [ ] The semantic model stays the source of truth — no data lives only in React Flow state
- [ ] Layout changes touch views, not elements
- [ ] REST and MCP still go through the same domain services
- [ ] New DTOs are defined in `packages/contracts`
- [ ] User-facing copy goes through i18n (`en` and `pl` locales updated)
