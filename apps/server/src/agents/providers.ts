import type { AgentChat, AgentSettings } from "@structsmith/contracts";

export interface AgentInvocation {
  command: string;
  args: string[];
  stdin: string;
}

/** Argument arrays only: prompts, model names and paths never go through a shell. */
export function agentInvocation(
  chat: AgentChat,
  settings: AgentSettings,
  prompt: string,
  mcpUrl: string,
): AgentInvocation {
  const config = settings.providers[chat.provider];
  const model = config.model ? ["--model", config.model] : [];
  const mcp = JSON.stringify({ mcpServers: { structsmith: { type: "http", url: mcpUrl } } });
  if (chat.provider === "codex") {
    const effort = settings.providers.codex.reasoningEffort;
    return {
      command: config.executable,
      args: [
        "exec",
        "--json",
        "--color",
        "never",
        "--skip-git-repo-check",
        "--ephemeral",
        "--ignore-user-config",
        "--sandbox",
        "read-only",
        "-c",
        'approval_policy="never"',
        "-c",
        `mcp_servers.structsmith.url=${JSON.stringify(mcpUrl)}`,
        "-c",
        'mcp_servers.structsmith.default_tools_approval_mode="approve"',
        ...model,
        ...(effort === "default" ? [] : ["-c", `model_reasoning_effort=${JSON.stringify(effort)}`]),
        "-",
      ],
      stdin: prompt,
    };
  }
  if (chat.provider === "claude") {
    return {
      command: config.executable,
      args: [
        "--print",
        "--output-format",
        "stream-json",
        "--verbose",
        "--no-session-persistence",
        "--strict-mcp-config",
        "--mcp-config",
        mcp,
        "--permission-mode",
        "dontAsk",
        "--tools",
        "Read,Glob,Grep",
        "--allowedTools",
        "Read,Glob,Grep,mcp__structsmith__*",
        ...model,
      ],
      stdin: prompt,
    };
  }
  return {
    command: config.executable,
    args: [
      "--prompt",
      prompt,
      "--silent",
      "--no-color",
      "--disable-builtin-mcps",
      "--no-ask-user",
      "--no-auto-update",
      "--additional-mcp-config",
      JSON.stringify({ mcpServers: { structsmith: { type: "http", url: mcpUrl, tools: ["*"] } } }),
      "--allow-tool=structsmith",
      "--allow-tool=read",
      "--deny-tool=shell",
      "--deny-tool=write",
      ...model,
    ],
    stdin: "",
  };
}

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue =>
  value !== null && typeof value === "object" ? (value as ObjectValue) : {};

export interface AgentOutput {
  text?: string;
  replace?: boolean;
  progress?: string;
  error?: string;
}

export function parseAgentLine(provider: AgentChat["provider"], line: string): AgentOutput {
  if (provider === "copilot") return { text: `${line}\n` };
  let event: ObjectValue;
  try {
    event = object(JSON.parse(line));
  } catch {
    return {};
  }
  if (provider === "codex") {
    const item = object(event.item);
    if (
      event.type === "item.completed" &&
      item.type === "agent_message" &&
      typeof item.text === "string"
    ) {
      return { text: `${item.text}\n\n` };
    }
    if (event.type === "item.started" && item.type === "mcp_tool_call") {
      return { progress: `${item.server ?? "MCP"}: ${item.tool ?? "tool"}` };
    }
    if (event.type === "error" || event.type === "turn.failed") {
      const error = object(event.error);
      return { error: String(error.message ?? event.message ?? "Codex failed.") };
    }
  } else {
    if (event.type === "assistant") {
      const content = object(event.message).content;
      if (!Array.isArray(content)) return {};
      const text = content
        .map(object)
        .filter((x) => x.type === "text")
        .map((x) => x.text)
        .join("\n");
      const tool = content.map(object).find((x) => x.type === "tool_use");
      return {
        ...(text ? { text: `${text}\n\n` } : {}),
        ...(tool ? { progress: String(tool.name) } : {}),
      };
    }
    if (event.type === "result") {
      if (event.is_error)
        return {
          error: Array.isArray(event.errors)
            ? event.errors.join("\n")
            : String(event.result ?? event.subtype ?? "Claude failed."),
        };
      if (typeof event.result === "string") return { text: event.result, replace: true };
    }
  }
  return {};
}
