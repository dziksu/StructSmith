# Local agent chat

The in-app chat uses the CLI already installed and signed in on the machine
running StructSmith. It supports Codex, Claude Code and GitHub Copilot. The server
launches the selected executable directly, with argument arrays and pipes, and
never interpolates messages into shell commands.

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
  model for each provider. A blank model uses the provider's default. Codex runs
  with `--ignore-user-config` to keep unrelated MCP servers out of this chat;
  select a model here to override its built-in default.
- **Codex reasoning effort**: choose **Default** or an explicit thinking level in
  Agent settings. It applies to all Codex topics and is passed as
  `-c 'model_reasoning_effort="high"'` (with the selected level). **Default** adds
  no override and keeps the CLI's built-in behavior. The select uses supported
  levels from the local `$CODEX_HOME/models_cache.json` catalog, or
  `~/.codex/models_cache.json` when `CODEX_HOME` is unset. If a model is not in the
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
a new topic with a summary. The UI polls only while responses are running.

Replies render as plain text, including code and Markdown, without HTML execution.
Partial replies and current MCP tool activity are visible as the CLI emits events;
provider token-by-token output and interactive permission dialogs are future work.
Stop ends the CLI process group on macOS/Linux, with a kill fallback. Already
committed architecture changes remain available for review/restoration in snapshots.

A Docker deployment does not automatically access host-installed CLIs or host
paths. Use the native source setup for local development. For a remote deployment,
leave the CLI bridge disabled and use an external MCP client instead.

## Provider adapters

- Codex: `codex exec --json`, prompt on stdin, ephemeral session, read-only file
  sandbox, per-run MCP URL and approved scoped MCP tools. See the official
  [non-interactive mode](https://developers.openai.com/codex/noninteractive) and
  [MCP configuration](https://developers.openai.com/codex/mcp) documentation.
- Claude Code: print mode with `stream-json`, `dontAsk`, explicit read tools and
  approved StructSmith MCP tools, strict per-run MCP configuration, prompt on
  stdin. See [programmatic usage](https://code.claude.com/docs/en/headless) and
  [CLI reference](https://code.claude.com/docs/en/cli-reference).
- Copilot: `copilot --prompt`, silent text output, session MCP configuration,
  permitted StructSmith/read tools and denied shell/write tools. See the
  [GitHub CLI reference](https://docs.github.com/en/copilot/reference/cli-command-reference).

The automated tests use disposable fake executables, real domain services and
MCP transports. They verify context/history, cancellation, restart recovery,
scope enforcement, revision conflicts, snapshots, validation and local route
guards without consuming provider usage. Real authenticated Codex/Claude/Copilot
inference should be checked on your local installations.
