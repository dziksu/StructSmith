import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer, type McpServerOptions } from "./server";

interface Session {
  transport: StreamableHTTPServerTransport;
  close(): Promise<void>;
}

/**
 * Streamable HTTP transport (spec §20). The deprecated SSE transport is not
 * implemented on purpose.
 */
export class McpHttpHandler {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly options: McpServerOptions) {}

  get sessionCount(): number {
    return this.sessions.size;
  }

  async handle(req: IncomingMessage, res: ServerResponse, body?: unknown): Promise<void> {
    const sessionId = req.headers["mcp-session-id"];
    const id = Array.isArray(sessionId) ? sessionId[0] : sessionId;

    if (id) {
      const session = this.sessions.get(id);
      if (!session) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32001, message: "Unknown MCP session." },
            id: null,
          }),
        );
        return;
      }
      await session.transport.handleRequest(req, res, body);
      return;
    }

    if (req.method !== "POST" || !isInitializeRequest(body)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Expected an MCP initialize request or a session id." },
          id: null,
        }),
      );
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newId: string) => {
        this.sessions.set(newId, {
          transport,
          close: async () => {
            await transport.close();
          },
        });
      },
    });

    const server = createMcpServer(this.options);

    transport.onclose = () => {
      const closedId = transport.sessionId;
      if (closedId) this.sessions.delete(closedId);
      void server.close();
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  async closeAll(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.all(sessions.map((session) => session.close().catch(() => undefined)));
  }
}
