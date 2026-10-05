import { Agent, request as httpRequest } from "node:http";
import express, { type RequestHandler } from "express";
import { AgentChatService } from "../agents/service";
import { loadConfig } from "../config";
import { errorMiddleware } from "../http-errors";
import { agentChatRoutes, localAgentAccess } from "../routes/agent-chat";
import { assertLocalUrl, RemoteChatBackend } from "./backend";

const hopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/** Node pipes preserve SSE/backpressure and never buffer the entire proxied response. */
export function dockerProxy(url: URL, token: string, agent: Agent): RequestHandler {
  assertLocalUrl(url);
  return (req, res) => {
    if (!req.url.startsWith("/") || req.url.startsWith("//")) {
      res.status(400).end();
      return;
    }
    const headers = { ...req.headers };
    const connectionHeaders = new Set(
      (req.get("connection") ?? "")
        .toLowerCase()
        .split(",")
        .map((name) => name.trim()),
    );
    for (const name of Object.keys(headers)) {
      if (
        hopHeaders.has(name) ||
        connectionHeaders.has(name) ||
        name.startsWith("x-forwarded-") ||
        name === "host"
      )
        delete headers[name];
    }
    headers.authorization = `Bearer ${token}`;
    const upstream = httpRequest(
      {
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port,
        path: req.url,
        method: req.method,
        headers,
        agent,
      },
      (response) => {
        res.statusCode = response.statusCode ?? 502;
        const responseConnection = new Set(
          (response.headers.connection ?? "")
            .toLowerCase()
            .split(",")
            .map((name) => name.trim()),
        );
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined && !hopHeaders.has(name) && !responseConnection.has(name))
            res.setHeader(name, value);
        }
        response.on("error", () => res.destroy());
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent)
        res.status(502).json({
          error: {
            code: "DOCKER_UNAVAILABLE",
            message: "The StructSmith Docker backend is unavailable.",
          },
        });
      else res.destroy();
    });
    upstream.setTimeout(35000, () => upstream.destroy());
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => {
      if (!res.writableEnded) upstream.destroy();
    });
    req.pipe(upstream);
  };
}

export interface LocalAppOptions {
  backendUrl: URL;
  token: string;
  chatDirectory: string;
  port: number;
  onStop?: () => void;
}

export async function createLocalApp(options: LocalAppOptions) {
  const backend = await RemoteChatBackend.connect(options.backendUrl, options.token);
  let agents: AgentChatService;
  try {
    agents = new AgentChatService(backend, options.chatDirectory, backend.readOnly);
  } catch (error) {
    await backend.close();
    throw error;
  }
  const app = express();
  const proxyAgent = new Agent({ keepAlive: true });
  app.disable("x-powered-by");
  // All entry points are local, including the proxy. No bridge gateway whitelist is necessary.
  app.use(localAgentAccess(true));
  app.get("/api/mcp-info", (req, res) => {
    res.json({
      ...backend.info,
      endpoint: `http://127.0.0.1:${req.socket.localPort ?? options.port}/mcp`,
      authMode: "none",
    });
  });
  app.get("/__structsmith_local/status", (req, res) => {
    if (req.get("authorization") !== `Bearer ${options.token}`) {
      res.status(401).end();
      return;
    }
    res.json({ running: true, mode: "docker-local", port: options.port });
  });
  app.post("/__structsmith_local/stop", (req, res) => {
    if (req.get("authorization") !== `Bearer ${options.token}`) {
      res.status(401).end();
      return;
    }
    res.status(202).json({ stopping: true });
    setImmediate(() => options.onStop?.());
  });
  app.use("/api/agent-chat", express.json({ limit: "16mb" }));
  app.all("/api/agent-chat/mcp/:key", (req, res, next) => {
    const bridge = agents.mcp(String(req.params.key));
    if (!bridge) {
      res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Agent turn is no longer active." } });
      return;
    }
    bridge.handle(req, res, req.body).catch(next);
  });
  const config = {
    ...loadConfig(),
    port: options.port,
    agentChatDir: options.chatDirectory,
    mcpReadOnly: backend.readOnly,
  };
  app.use("/api/agent-chat", agentChatRoutes(agents, config));
  app.use(dockerProxy(options.backendUrl, options.token, proxyAgent));
  app.use(errorMiddleware);
  return {
    app,
    agents,
    backend,
    async close() {
      try {
        await agents.close();
      } finally {
        try {
          await backend.close();
        } finally {
          proxyAgent.destroy();
        }
      }
    },
  };
}
