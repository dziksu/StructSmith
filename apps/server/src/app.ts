import { join } from "node:path";
import type { HealthResponse } from "@structsmith/contracts";
import { McpHttpHandler } from "@structsmith/mcp";
import cors from "cors";
import express, { type Express } from "express";
import { AgentChatService } from "./agents/service";
import { createAuthMiddleware } from "./auth";
import type { AppContext } from "./bootstrap";
import { errorMiddleware } from "./http-errors";
import { agentChatRoutes, localAgentAccess } from "./routes/agent-chat";
import { modelRoutes } from "./routes/model";
import { systemRoutes } from "./routes/system";
import { workspaceRoutes } from "./routes/workspaces";

export interface AppHandle {
  app: Express;
  mcp: McpHttpHandler;
  agents: AgentChatService | null;
}

export function createApp(ctx: AppContext): AppHandle {
  const app = express();
  const auth = createAuthMiddleware(ctx.config);
  const agents = ctx.config.agentChatEnabled
    ? new AgentChatService(ctx.services, ctx.config.agentChatDir, ctx.config.mcpReadOnly)
    : null;

  app.disable("x-powered-by");
  app.use(cors({ exposedHeaders: ["mcp-session-id"], allowedHeaders: ["*"] }));
  app.use(express.json({ limit: "16mb" }));

  /* ------------------------------- health ------------------------------- */

  app.get("/health", (_req, res) => {
    let database: HealthResponse["database"] = "ok";
    try {
      ctx.database.sqlite.query("SELECT 1").get();
    } catch {
      database = "error";
    }
    const body: HealthResponse = {
      status: database === "ok" ? "ok" : "degraded",
      database,
      mcp: "ok",
      version: ctx.config.version,
    };
    res.status(database === "ok" ? 200 : 503).json(body);
  });

  /* -------------------------------- REST -------------------------------- */

  const api = express.Router();
  // The per-run MCP capability is random, local-only and revoked at the end of a turn.
  // It carries no APP_TOKEN into CLI arguments and has its own scoped tool set.
  app.all(
    "/api/agent-chat/mcp/:key",
    localAgentAccess(ctx.config.agentChatEnabled),
    (req, res, next) => {
      const bridge = agents?.mcp(String(req.params.key));
      if (!bridge) {
        res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: "Agent turn is no longer active." } });
        return;
      }
      bridge.handle(req, res, req.body).catch(next);
    },
  );
  api.use("/agent-chat", localAgentAccess(ctx.config.agentChatEnabled));
  if (agents) api.use("/agent-chat", agentChatRoutes(agents, ctx.config));
  api.use(workspaceRoutes(ctx.services));
  api.use(modelRoutes(ctx.services));
  api.use(systemRoutes(ctx));
  app.use("/api", auth, api);

  /* --------------------------------- MCP -------------------------------- */

  const mcp = new McpHttpHandler({ services: ctx.services, readOnly: ctx.config.mcpReadOnly });

  app.all("/mcp", auth, (req, res, next) => {
    mcp.handle(req, res, req.body).catch(next);
  });

  /* ------------------------------ static UI ----------------------------- */

  if (ctx.config.webDistDir) {
    const dist = ctx.config.webDistDir;
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/(api|mcp|health)).*/, (_req, res) => {
      res.sendFile(join(dist, "index.html"));
    });
  }

  app.use(errorMiddleware);

  return { app, mcp, agents };
}
