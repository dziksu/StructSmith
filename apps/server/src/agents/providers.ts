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
    return {
      command: config.executable,
      args: [
        "app-server",
        "-c",
        "features.hooks=false",
        "-c",
        "features.plugins=false",
        "-c",
        "features.apps=false",
        "-c",
        "apps._default.enabled=false",
        "-c",
        "notify=[]",
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
        "--include-partial-messages",
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
      "--output-format",
      "json",
      "--stream",
      "on",
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
export const object = (value: unknown): ObjectValue =>
  value !== null && typeof value === "object" ? (value as ObjectValue) : {};

export interface AgentOutput {
  text?: string;
  reasoning?: string;
  progress?: string;
  error?: string;
}

/** Full blocks replace their deltas by ID, so final events cannot duplicate streamed text. */
export class AgentOutputParser {
  private readonly text = new Map<string, string>();
  private readonly reasoning = new Map<string, string>();
  private claudeMessage = "";
  private claudeSequence = 0;
  private claudeBlockIndex = 0;
  private claudeStreaming = false;

  constructor(private readonly provider: AgentChat["provider"]) {}

  parse(event: ObjectValue): AgentOutput {
    const output: AgentOutput = {};
    const put = (kind: "text" | "reasoning", key: string, value: unknown, append = false) => {
      if (typeof value !== "string") return;
      const blocks = this[kind];
      blocks.set(key, append ? (blocks.get(key) ?? "") + value : value);
      output[kind] = [...blocks.values()].filter(Boolean).join("\n\n");
      output.progress = "";
    };
    if (this.provider === "codex") {
      const params = object(event.params);
      const item = object(params.item);
      const key = String(params.itemId ?? item.id ?? "message");
      if (event.method === "item/agentMessage/delta") put("text", key, params.delta, true);
      if (event.method === "item/reasoning/summaryTextDelta")
        put("reasoning", `${key}:${params.summaryIndex ?? 0}`, params.delta, true);
      if (event.method === "item/completed" && item.type === "agentMessage")
        put("text", key, item.text);
      if (
        event.method === "item/completed" &&
        item.type === "reasoning" &&
        Array.isArray(item.summary)
      )
        item.summary.forEach((summary, index) => {
          put("reasoning", `${key}:${index}`, summary);
        });
      if (event.method === "item/started" && item.type === "mcpToolCall")
        output.progress = `StructSmith: ${item.tool ?? "tool"}`;
      if (event.method === "error" && !params.willRetry)
        output.error = String(object(params.error).message ?? "Codex failed.");
    } else if (this.provider === "claude") {
      // Subagent content belongs to a tool result, not to the parent assistant's reply.
      if (event.parent_tool_use_id) return output;
      const stream = object(event.event);
      if (event.type === "stream_event") {
        if (stream.type === "message_start") {
          this.claudeMessage = String(object(stream.message).id ?? ++this.claudeSequence);
          this.claudeStreaming = true;
          this.claudeBlockIndex = 0;
        }
        if (stream.type === "content_block_start" && typeof stream.index === "number")
          this.claudeBlockIndex = stream.index;
        if (stream.type === "message_stop") this.claudeStreaming = false;
        const key = `${this.claudeMessage}:${stream.index ?? 0}`;
        const block = object(stream.content_block);
        const delta = object(stream.delta);
        if (stream.type === "content_block_start") {
          if (block.type === "text") put("text", key, block.text);
          if (block.type === "thinking") put("reasoning", key, block.thinking);
          if (block.type === "tool_use") output.progress = String(block.name ?? "MCP");
        }
        if (stream.type === "content_block_delta") {
          if (delta.type === "text_delta") put("text", key, delta.text, true);
          if (delta.type === "thinking_delta") put("reasoning", key, delta.thinking, true);
        }
      }
      if (event.type === "assistant") {
        const message = object(event.message);
        const key = String(message.id ?? (this.claudeMessage || ++this.claudeSequence));
        const content = message.content;
        if (Array.isArray(content))
          content.map(object).forEach((block, index) => {
            // Claude emits one assistant envelope per completed block, sharing a message ID.
            const blockIndex =
              this.claudeStreaming && key === this.claudeMessage && content.length === 1
                ? this.claudeBlockIndex
                : index;
            if (block.type === "text") put("text", `${key}:${blockIndex}`, block.text);
            if (block.type === "thinking") put("reasoning", `${key}:${blockIndex}`, block.thinking);
            if (block.type === "tool_use") output.progress = String(block.name ?? "MCP");
          });
      }
      if (event.type === "result") {
        if (event.is_error)
          output.error = Array.isArray(event.errors)
            ? event.errors.join("\n")
            : String(event.result ?? event.subtype ?? "Claude failed.");
        else if (typeof event.result === "string") output.text = event.result;
      }
    } else {
      if (event.agentId || object(event.data).parentToolCallId) return output;
      const data = object(event.data);
      const key = String(data.messageId ?? data.reasoningId ?? "message");
      if (event.type === "assistant.message_delta") put("text", key, data.deltaContent, true);
      if (event.type === "assistant.message") {
        put("text", key, data.content);
        if (
          typeof data.reasoningText === "string" &&
          ![...this.reasoning.values()].includes(data.reasoningText)
        )
          put("reasoning", key, data.reasoningText);
      }
      if (event.type === "assistant.reasoning_delta")
        put("reasoning", key, data.deltaContent, true);
      if (event.type === "assistant.reasoning") put("reasoning", key, data.content);
      if (event.type === "tool.execution_start") output.progress = String(data.toolName ?? "MCP");
      if (event.type === "assistant.intent") output.progress = String(data.intent ?? "");
      if (event.type === "session.error") output.error = String(data.message ?? "Copilot failed.");
    }
    return output;
  }
}
