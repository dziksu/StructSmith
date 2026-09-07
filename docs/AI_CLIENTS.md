# Install StructSmith in AI clients

StructSmith exposes one MCP endpoint from the same process as its UI and REST API. An AI client
connected to it reads and updates the same semantic architecture model that is open in the
browser.

This guide uses the default Docker endpoint:

```text
http://localhost:8090/mcp
```

For local development use `http://localhost:3000/mcp`. For a custom port, open **MCP** in the
StructSmith top bar and copy the live endpoint shown there.

## Support matrix

| Client | Local `localhost` | Public HTTPS | Recommended setup |
| --- | --- | --- | --- |
| Codex Desktop, CLI and IDE | Yes | Yes | Native Streamable HTTP |
| Claude Code | Yes | Yes | Native Streamable HTTP |
| Claude Desktop | Yes, through a local bridge | Yes, as a custom connector | Bridge for local; connector for public |
| GitHub Copilot CLI | Yes | Yes | Native Streamable HTTP |
| VS Code / Copilot Chat | Yes | Yes | `.vscode/mcp.json` |
| Cursor, Windsurf and other clients | Client-dependent | Client-dependent | Native HTTP when available; otherwise STDIO bridge |

## Codex Desktop, CLI and IDE extension

The fastest setup is one CLI command:

```bash
codex mcp add structsmith --url http://localhost:8090/mcp
```

Codex Desktop, Codex CLI and the Codex IDE extension use the MCP configuration of the same Codex
host. You can also configure it in Codex Desktop:

1. Open **Settings → MCP servers**.
2. Select **Add server**.
3. Enter `structsmith`, choose **Streamable HTTP**, and paste
   `http://localhost:8090/mcp`.
4. Save and restart the current session.

For project-scoped configuration, create `.codex/config.toml` in a trusted project:

```toml
[mcp_servers.structsmith]
url = "http://localhost:8090/mcp"
default_tools_approval_mode = "writes"
tool_timeout_sec = 120
```

Check the connection with `codex mcp list` or `/mcp` in a Codex session. See the
[official OpenAI MCP documentation](https://developers.openai.com/codex/mcp/).

## Claude Code

Add the HTTP server directly:

```bash
claude mcp add --transport http structsmith http://localhost:8090/mcp
```

Run `/mcp` inside Claude Code to inspect the connection and available tools. To share the setup
with a team, use a project `.mcp.json`:

```json
{
  "mcpServers": {
    "structsmith": {
      "type": "http",
      "url": "http://localhost:8090/mcp"
    }
  }
}
```

See the [official Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp).

## Claude Desktop

Claude Desktop has two different connection paths. Choose the one that matches where
StructSmith runs.

### Local StructSmith on `localhost`

Claude Desktop's local MCP configuration launches STDIO processes. To connect that mechanism to
StructSmith's Streamable HTTP endpoint, use the third-party
[`mcp-remote`](https://github.com/geelen/mcp-remote) bridge. It requires Node.js 18 or newer.

Open Claude Desktop once, then edit its configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Merge this entry with any existing `mcpServers` entries:

```json
{
  "mcpServers": {
    "structsmith": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "http://localhost:8090/mcp",
        "--transport",
        "http-only",
        "--allow-http"
      ]
    }
  }
}
```

Fully quit and reopen Claude Desktop. If the app cannot find `npx`, replace `"npx"` with the
absolute path returned by `which npx` (macOS/Linux) or `where npx` (Windows).

`mcp-remote` is an independent, experimental compatibility bridge; review it before allowing
write tools. A native StructSmith `.mcpb` desktop extension is not currently published.

### Public StructSmith over HTTPS

In Claude Desktop open **Customize → Connectors**, select **Add custom connector**, and enter the
public MCP URL. This connection originates from Anthropic's cloud, not from the desktop app, so
`localhost`, private LAN addresses and VPN-only hosts are not reachable through this path.

Do not publish an unauthenticated StructSmith instance to the internet. StructSmith currently
supports static bearer-token authentication rather than OAuth, so confirm that your chosen
connector or gateway can supply the required `Authorization` header. See Anthropic's
[remote connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
and [desktop extension guide](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

## GitHub Copilot CLI

Add StructSmith with one command:

```bash
copilot mcp add --transport http structsmith http://localhost:8090/mcp
```

Verify it with `copilot mcp list`. For a shared repository configuration, use `.mcp.json` or
`.github/mcp.json`:

```json
{
  "mcpServers": {
    "structsmith": {
      "type": "http",
      "url": "http://localhost:8090/mcp",
      "tools": ["*"]
    }
  }
}
```

Project-level servers load only after the folder is trusted. Copilot CLI does not read
`.vscode/mcp.json`; use one of the project files above for the CLI. See the
[official GitHub Copilot CLI instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers).

## VS Code with GitHub Copilot

Create `.vscode/mcp.json` in the project where Copilot should use StructSmith:

```json
{
  "servers": {
    "structsmith": {
      "type": "http",
      "url": "http://localhost:8090/mcp"
    }
  }
}
```

Save the file, approve the workspace trust prompt, and run **MCP: List Servers** from the command
palette. Use Copilot Chat in **Agent** mode so it can invoke tools. See the
[VS Code MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).

## Cursor, Windsurf, JetBrains and other clients

Prefer a native Streamable HTTP server definition when the client supports it:

```json
{
  "mcpServers": {
    "structsmith": {
      "type": "http",
      "url": "http://localhost:8090/mcp"
    }
  }
}
```

Some clients use `servers` instead of `mcpServers`, or omit `type`. Use the client's MCP settings
screen when available. For a STDIO-only client, use the same `mcp-remote` bridge shown for Claude
Desktop, or run StructSmith from source with `bun run mcp:stdio`.

## Token authentication

The local default has no authentication. Before exposing StructSmith outside your machine, set
`AUTH_MODE=token`, set a strong `APP_TOKEN`, and put TLS in front of it. Never commit the token to
a repository.

Clients with native HTTP headers should send:

```text
Authorization: Bearer YOUR_TOKEN
```

Claude Code and Copilot CLI accept the header during installation:

```bash
claude mcp add --transport http structsmith https://structsmith.example.com/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"

copilot mcp add --transport http structsmith https://structsmith.example.com/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"
```

For Codex, keep the token in an environment variable:

```toml
[mcp_servers.structsmith]
url = "https://structsmith.example.com/mcp"
bearer_token_env_var = "STRUCTSMITH_TOKEN"
```

For VS Code, use an input variable so the token is stored outside the configuration file:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "structsmith-token",
      "description": "StructSmith access token",
      "password": true
    }
  ],
  "servers": {
    "structsmith": {
      "type": "http",
      "url": "https://structsmith.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${input:structsmith-token}"
      }
    }
  }
}
```

See [SECURITY.md](../SECURITY.md) before making the service reachable outside localhost.

## Verify and troubleshoot

1. Open the StructSmith **MCP** page and confirm that the endpoint is running.
2. Check `http://localhost:8090/health` in a browser or with `curl`.
3. List MCP servers in the client and confirm that `structsmith` exposes tools.
4. Start with `workspace_list`, then call `workspace_inspect` for one workspace.
5. If Docker is running on a different machine, replace `localhost` with that machine's reachable
   hostname and secure the connection.

Cloud agents cannot reach a service bound to your laptop's `localhost`. Use a secured HTTPS
deployment or a client feature that runs MCP locally on the same machine as StructSmith.
