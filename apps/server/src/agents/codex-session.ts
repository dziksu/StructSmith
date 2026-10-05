import { randomUUID } from "node:crypto";
import type { AgentSettings } from "@structsmith/contracts";
import { agentErrorMessage, object } from "./providers";

// config/read includes null defaults; JSON-to-TOML overrides cannot round-trip those nulls.
const configValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(configValue);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(object(value))
        .filter(([, entry]) => entry !== null)
        .map(([key, entry]) => [key, configValue(entry)]),
    );
  return value;
};

/** A single ephemeral turn over the installed CLI's newline-delimited JSON-RPC protocol. */
export class CodexSession {
  threadId: string | undefined;
  private readonly serverName = `structsmith_${randomUUID().replaceAll("-", "").slice(0, 12)}`;

  constructor(
    private readonly write: (value: unknown) => void,
    private readonly finish: (error?: string) => void,
    private readonly settings: AgentSettings["providers"]["codex"],
    private readonly cwd: string,
    private readonly prompt: string,
    private readonly mcpUrl: string,
  ) {}

  start(): void {
    this.write({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: { name: "structsmith", title: "StructSmith", version: "1" },
      },
    });
  }

  receive(event: Record<string, unknown>): void {
    if (event.id !== undefined) {
      if (event.method) {
        // Interactive approvals/elicitation are unavailable in this unattended local bridge.
        this.write({
          id: event.id,
          error: {
            code: -32601,
            message: "Interactive requests are unavailable in StructSmith chat.",
          },
        });
        this.finish(
          "The CLI requested interactive input. Check its configuration in your terminal.",
        );
        return;
      }
      if (event.error) {
        this.finish(agentErrorMessage(event.error));
        return;
      }
      const result = object(event.result);
      if (event.id === 1) {
        this.write({ method: "initialized" });
        this.write({
          id: 2,
          method: "config/read",
          params: { cwd: this.cwd, includeLayers: false },
        });
      }
      if (event.id === 2) {
        const config = object(result.config);
        const overrides: Record<string, unknown> = {
          "features.hooks": false,
          "features.plugins": false,
          "features.apps": false,
          "apps._default.enabled": false,
          notify: [],
          web_search: "disabled",
        };
        if (this.settings.reasoningEffort !== "default")
          overrides.model_reasoning_effort = this.settings.reasoningEffort;
        // Reuse CLI authentication, but expose only this turn's project-scoped MCP server.
        // A fresh name also avoids merging a user's similarly named stdio server with our URL.
        const servers: Record<string, Record<string, unknown>> = Object.fromEntries(
          Object.entries(object(config.mcp_servers)).map(([name, value]) => [
            name,
            { ...object(configValue(value)), enabled: false },
          ]),
        );
        overrides.plugins = Object.fromEntries(
          Object.entries(object(config.plugins)).map(([name, value]) => [
            name,
            { ...object(configValue(value)), enabled: false },
          ]),
        );
        servers[this.serverName] = {
          url: this.mcpUrl,
          enabled: true,
          required: true,
          default_tools_approval_mode: "approve",
        };
        overrides.mcp_servers = servers;
        this.write({
          id: 3,
          method: "thread/start",
          params: {
            cwd: this.cwd,
            approvalPolicy: "never",
            sandbox: "read-only",
            ephemeral: true,
            ...(this.settings.model ? { model: this.settings.model } : {}),
            config: overrides,
          },
        });
      }
      if (event.id === 3) {
        const id = object(result.thread).id;
        if (typeof id !== "string") {
          this.finish("Codex did not return a thread ID. Update the CLI and try again.");
          return;
        }
        this.threadId = id;
        this.write({
          id: 4,
          method: "turn/start",
          params: {
            threadId: id,
            input: [{ type: "text", text: this.prompt, text_elements: [] }],
            approvalPolicy: "never",
            sandboxPolicy: { type: "readOnly" },
            summary: "concise",
            ...(this.settings.model ? { model: this.settings.model } : {}),
            ...(this.settings.reasoningEffort === "default"
              ? {}
              : { effort: this.settings.reasoningEffort }),
          },
        });
      }
    }
    const params = object(event.params);
    if (event.method === "turn/completed" && params.threadId === this.threadId) {
      const turn = object(params.turn);
      this.finish(
        turn.status === "completed"
          ? undefined
          : agentErrorMessage(turn.error ?? `Codex turn ${turn.status ?? "failed"}.`),
      );
    }
  }
}
