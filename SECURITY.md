# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub Security Advisories](https://github.com/dziksu/structsmith/security/advisories/new)
rather than opening a public issue. Include reproduction steps and the version or
commit you tested. Expect an initial response within a few days.

## Threat model

StructSmith is a **local-first, single-user tool**. It deliberately has no user
accounts, no roles and no multi-tenancy — the security boundary is the machine or
network it runs on, not the application.

## Deployment notes that matter

**The default configuration is unauthenticated.** `AUTH_MODE=none` leaves `/api`
and `/mcp` fully open, and the server binds `0.0.0.0`, so with the default Docker
port mapping anyone who can reach the port can read *and modify* every workspace.
That is intended for `localhost`, not for a shared network.

Before exposing StructSmith beyond your own machine:

- Set `AUTH_MODE=token` and a strong `APP_TOKEN`. Clients must then send
  `Authorization: Bearer <token>` to `/api` and `/mcp`. `/health` stays public.
- Terminate TLS in front of the app — the token travels in a header and the server
  speaks plain HTTP.
- Bind to the loopback interface (`HOST=127.0.0.1`) when you only need local access,
  and publish the container port as `127.0.0.1:8090:8080` rather than `8090:8080`.
- Consider `MCP_READ_ONLY=true` when an AI client should be able to read and
  validate the model but never change it.

## Data

Everything lives in one SQLite file (`DATABASE_PATH`, `/data/architecture.db` in
Docker). There is no telemetry, no outbound network traffic and no cloud
dependency. Snapshots keep previous versions of a workspace in the same file, so
treat a backup of that file as a backup of everything — including anything
sensitive you wrote into element descriptions or presales records.
