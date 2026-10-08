# Local agent chat

The in-app chat uses the CLI already installed and signed in on the machine
running StructSmith. It supports Codex, Claude Code and GitHub Copilot. The server
launches the selected executable directly, with argument arrays and pipes, and
never interpolates messages into shell commands.

For the technical design, protocols, implementation problems and a step-by-step
porting plan, see the [implementation guide in Polish](AGENT_CHAT_IMPLEMENTATION_PL.md).

## Try it locally

1. Run `bun run dev` from the `codex/local-agent-chat` branch. Use
   `http://localhost:5173` in the browser.
2. Open **Agent chat** in the lower right. Its gear opens **Agent settings**.
   Select your default CLI. If detection fails, set the absolute path reported
   by `which codex`, `which claude` or `which copilot` in your terminal. The
   StructSmith process inherits the PATH of the terminal that launched it.
3. Create a project topic and ask it to explain the model. On the home page,
   **General · no project** is selected by default; in the editor, new topics
   default to the currently open workspace. In this interface, a project means
   a StructSmith workspace.
4. Right-click a node or relationship and choose **Ask agent about this**. A chip
   shows the exact attached object. It joins the active idle topic if that topic
   belongs to the same project; otherwise it creates a new project topic. The
   message is sent only when you press **Send** or Enter.
5. Select **Edit architecture** and ask for a small change, such as renaming a
   selected node. Check the diagram, activity and snapshots. The agent can also
   update relationships, views, boundaries and records through batch operations.
6. Switch the provider and ask a follow-up. The topic's project and conversation
  history remain the same. Try **Stop**, close/reopen the panel, navigate to
  another project and reload the browser to check persistence.
7. Open the **…** menu beside a topic to **Rename** or **Archive** it. Archived
   topics move to the **Archive** tab and keep their project and complete history.
   Open one to read it or choose **Restore topic** to resume the conversation.
   These actions are disabled while the agent is running in that topic.

Sign in through the CLI in a terminal before testing. The app does not collect
API keys or handle interactive terminal login or approval prompts. CLI errors,
including authentication, model and permission errors, appear in the response.
Use current CLI versions supporting the flags listed below. Copilot uses the
standalone `copilot` program, rather than the older `gh copilot` extension.

## Scope and settings

- **Agent settings**: default provider for new topics, executable and optional
  model for each provider. Codex offers a shared UI select populated from the
  configured executable's `app-server` `model/list` RPC, including pagination and
  supported reasoning levels. **Use CLI default** adds no model override;
  **Custom model ID…** allows an explicit identifier. Refresh the list after
  changing the executable, upgrading the CLI or switching accounts. Model discovery
  never starts a thread or inference and has a bounded timeout. The CLI catalog can
  differ from the desktop app and does not guarantee account entitlement; inference
  can still reject a listed model. Other providers accept a model ID input.
  A blank model uses the CLI's configured default. Codex
  disables unrelated MCP servers, plugins, hooks and connected apps for this
  ephemeral chat session without changing the user's CLI configuration.
- **Codex reasoning effort**: choose **Default** or an explicit thinking level in
  Agent settings. It applies to all Codex topics and is passed as the app-server
  turn's `effort` parameter. **Default** adds no override and keeps the CLI's
  configured behavior. The select uses supported
  levels from the configured executable's `model/list` response. It does not read
  the desktop app's shared `models_cache.json`. If a model is not in the
  catalog, standard levels remain available with a compatibility hint; CLI errors
  appear in the conversation. Changing to a model that cannot use the selected
  level resets it to **Default**. Older saved settings also use **Default**.
- **Topic settings**: title and optional absolute source directory on the server.
  The directory is for reading source code. Architecture editing happens through
  MCP, and this initial version does not offer source file edits or shell approval
  dialogs. With no directory, agents run in an empty application-owned folder.
- **Ask**: the injected MCP server has read tools and a non-persisting preview.
- **Edit architecture**: the injected MCP server additionally offers
  `model_apply_operations`, bound to the topic's project and requiring
  `expectedRevision`. It delegates to the same domain service as REST and the
  public MCP endpoint, including snapshots, activity and live editor events.
- **General**: can inspect projects but cannot mutate them. Create a project topic
  to make a change. A topic's assignment cannot be changed accidentally by
  switching the currently visible workspace.

Each turn gets a random, temporary, localhost-only MCP URL. The server binds its
write capability to the current mode and project; it revokes the URL on Stop or
completion. It respects `MCP_READ_ONLY`. The bridge does not put `APP_TOKEN` in
CLI arguments or pass it in the child environment. Host, browser Origin and socket
checks restrict the chat routes even if the main server listens on `0.0.0.0`.
The CLI still uses its own provider credentials and communicates with that
provider. "Local CLI" describes where the process runs, not offline inference.

## Persistence and limits

`AGENT_CHAT_ENABLED=false` disables the bridge. `AGENT_CHAT_DIR` changes its storage
location (default `data/agent-chat`, ignored by Git). History/settings live in
`chats.json`, written atomically with private permissions. Restarted running turns
become failed responses and can be continued with a new message. Empty topics,
failed responses and completed conversations remain available until deleted.
Renaming and archive status persist across restarts. Older saved topics default
to active. Archived topics cannot accept messages until restored; archiving does
not delete messages or undo architecture changes.

To keep provider switching simple, each turn starts a fresh CLI invocation with
the completed conversation history and latest attached context. This does not
resume unrelated terminal sessions. The initial limits are 20,000 characters per
user message, 120,000 UTF-8 bytes per composed prompt, 2 MB output, three concurrent
topics and ten minutes per turn. When history grows past the prompt limit, start
a new topic with a summary. The UI subscribes to authenticated SSE updates while
the selected chat is open. It reconnects with a current snapshot and falls back
to polling during connection failures. A browser disconnect never stops a turn.

Replies render as plain text, including code and Markdown, without HTML execution.
Response deltas and current MCP tool activity appear as the CLI emits events.
Readable reasoning exposed by the CLI is saved separately and shown in a
collapsed **Reasoning** panel (Codex supplies reasoning summaries). Opaque or
encrypted reasoning and tool input JSON are never shown as assistant text.
Full-message events reconcile streamed blocks by ID instead of duplicating them.
Nested JSON error envelopes are unwrapped into readable provider messages; Codex
errors offer an **Agent settings** button to adjust the model before another turn.
Interactive permission dialogs are not supported.
Stop ends the CLI process group on macOS/Linux, with a kill fallback. Already
committed architecture changes remain available for review/restoration in snapshots.

## Docker with agents on the host

The local launcher keeps the full UI, domain and model database in Docker while
running `AgentChatService` and the native agent processes on the host. Install
Docker, curl and your preferred signed-in CLI on macOS/Linux arm64 or x64, then:

```bash
curl -fsSL https://github.com/dziksu/StructSmith/releases/latest/download/structsmith-local-install.sh | sh
```

The binary/checksums/installer are attached by CI after the matching Docker image
is published. If the download returns 404, check those publication jobs: release
notes alone do not confirm that the installer is available. Bun is compiled into
the executable; neither Bun, Node.js nor a repository checkout is needed. Linux
binaries require glibc.

The installer writes a versioned binary and shortcut under
`~/.local/share/structsmith`. Run that `structsmith-local` shortcut again to start,
or with `status`/`stop` in another terminal. The helper stays in the foreground;
Ctrl+C cancels active agents and removes its container, retaining the named data
volume and host chat history. It validates container ID/ownership before cleanup.
A killed helper can recover its own leftover container on the next start.

Defaults are UI/chat on `http://localhost:8090`, token-authenticated Docker on
`127.0.0.1:8091`, container `structsmith-local`, volume `structsmith-data`, and
host history/settings in `~/.local/share/structsmith/chat`. `local.json` holds a
random backend token (mode 0600); a profile lock prevents two helpers writing the
same history. Ports occupied by other applications cause an error. No other
container is stopped automatically. `--data-dir PATH` selects a separate private
profile; `--port`, `--backend-port`, `--container`, `--volume`, `--read-only` and
`--no-open` are also available. Multiple profiles need distinct ports, container names and model volumes.
The launcher refuses a volume used by another running container. To install the binary elsewhere, set `STRUCTSMITH_LOCAL_DIR` for the
installer and pass the matching `--data-dir` when launching it.

The helper proxies non-chat REST, assets, public MCP and model SSE without
buffering responses. It injects the private backend token; native agents receive
only a temporary scoped host MCP URL. `/api/mcp-info` advertises the helper's local
MCP endpoint. Chat reads/operations go through `RemoteChatBackend` to Docker's
REST/MCP, preserving domain revision checks, snapshots, activity and UI events.
All helper routes enforce loopback socket, localhost Host/Origin and reject
cross-site browser requests. Docker itself has `AGENT_CHAT_ENABLED=false` in this
mode. There is no Docker gateway whitelist, credential mount or Docker socket
mount in the container.

Agents use the host PATH and CLI authentication. Source directories are host
paths; no bind mount into Docker is necessary. Model selection, reasoning effort,
streaming, topic ordering, archive/rename and Stop use the existing chat UI.
Agent provider authentication and interactive approvals remain CLI concerns.

The helper and Docker image must have the same product version. It uses a version
pinned GHCR tag rather than `latest`; updating by rerunning the installer downloads
the newly released pair. The launcher expects a local Docker engine (Docker
Desktop/Colima or native Linux Docker), not a daemon running on another machine.
Windows and non-glibc Linux are not packaged in this initial mode.

For source development or packaging:

```bash
docker build -t structsmith-local:dev .
bun run docker:local --image structsmith-local:dev
bun run build:local
# Build all four release targets:
bun run build:local --all
# Test an already built image with a disposable volume and fake native CLI:
bun scripts/smoke-local-helper.ts IMAGE
# Test a binary installed outside the checkout:
bun scripts/smoke-local-helper.ts IMAGE /path/to/structsmith-local
```

A plain Docker deployment still cannot start host-installed CLI programs. Its
chat history defaults to `/data/agent-chat` in the persistent volume, but the
stock image contains no agent CLIs and the local guard rejects a Docker bridge
peer. For remote deployments, keep the CLI bridge disabled and use an external
MCP client. The detailed guide records the
[original Docker findings and the new architecture](AGENT_CHAT_IMPLEMENTATION_PL.md#docker-i-agent-na-hoście).

## Provider adapters

- Codex: `codex app-server` over stdio JSON-RPC, initialized once per turn,
  ephemeral thread with read-only file sandbox and no interactive approvals.
  Model, effort and prompt are sent through `thread/start` / `turn/start`;
  agent-message deltas and reasoning-summary deltas stream to the UI.
  The per-run MCP URL exposes only approved scoped tools. See the official
  [app-server protocol](https://developers.openai.com/codex/app-server/) and
  [MCP configuration](https://developers.openai.com/codex/mcp) documentation.
- Claude Code: print mode with `stream-json`, `--include-partial-messages`,
  text/thinking content-block deltas, `dontAsk`, explicit read tools and
  approved StructSmith MCP tools, strict per-run MCP configuration, prompt on
  stdin. See [programmatic usage](https://code.claude.com/docs/en/headless) and
  [CLI reference](https://code.claude.com/docs/en/cli-reference).
- Copilot: `copilot --prompt --output-format json --stream on`, JSONL events,
  session MCP configuration,
  permitted StructSmith/read tools and denied shell/write tools. See the
    [GitHub CLI reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference).

The automated tests use disposable fake executables, real domain services and
MCP transports. They verify context/history, cancellation, restart recovery,
scope enforcement, revision conflicts, snapshots, validation and local route
guards without consuming provider usage. Real authenticated Codex/Claude/Copilot
inference should be checked on your local installations.
