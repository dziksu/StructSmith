import type { McpInfo, WorkspaceUpdatedEvent } from "@structsmith/contracts";
import { presets } from "@structsmith/domain";
import { MCP_PROMPTS, MCP_RESOURCES, MCP_TOOLS } from "@structsmith/mcp";
import { Router } from "express";
import type { AppContext } from "../bootstrap";
import { handler } from "../http-errors";

const HEARTBEAT_MS = 25_000;

export function systemRoutes(ctx: AppContext): Router {
  const router = Router();

  /** Server-sent events keep the UI in sync with MCP changes (spec §26). */
  router.get("/events", (req, res) => {
    const filter = typeof req.query.workspaceId === "string" ? req.query.workspaceId : null;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const unsubscribe = ctx.bus.subscribe((event) => {
      if (event.type !== "workspace.changed" && event.type !== "workspace.deleted") return;
      if (filter && event.workspaceId !== filter) return;

      if (event.type === "workspace.deleted") {
        res.write(
          `event: workspace.deleted\ndata: ${JSON.stringify({ workspaceId: event.workspaceId })}\n\n`,
        );
        return;
      }

      const payload: WorkspaceUpdatedEvent = {
        workspaceId: event.workspaceId,
        revision: event.revision,
        source: event.source,
        message: event.message,
      };
      res.write(`event: workspace.updated\ndata: ${JSON.stringify(payload)}\n\n`);
    });

    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  router.get(
    "/mcp-info",
    handler((req, res) => {
      const host = req.get("host") ?? `localhost:${ctx.config.port}`;
      const protocol = req.protocol === "https" ? "https" : "http";
      const info: McpInfo = {
        status: "running",
        transport: "streamable-http",
        endpoint: `${protocol}://${host}/mcp`,
        readOnly: ctx.config.mcpReadOnly,
        authMode: ctx.config.authMode,
        tools: MCP_TOOLS.filter((tool) => !ctx.config.mcpReadOnly || !tool.mutating).map(
          (tool) => ({
            ...tool,
          }),
        ),
        resources: [...MCP_RESOURCES],
        prompts: MCP_PROMPTS.map((prompt) => ({ ...prompt })),
      };
      res.json(info);
    }),
  );

  router.get(
    "/presets",
    handler((_req, res) => res.json({ presets })),
  );

  router.get(
    "/settings",
    handler((_req, res) =>
      res.json({
        productName: ctx.config.productName,
        version: ctx.config.version,
        authMode: ctx.config.authMode,
        mcpReadOnly: ctx.config.mcpReadOnly,
      }),
    ),
  );

  return router;
}
