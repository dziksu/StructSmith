import {
  type AgentSettingsResponse,
  AgentSettingsSchema,
  CreateAgentChatSchema,
  SendAgentMessageSchema,
  UpdateAgentChatSchema,
} from "@structsmith/contracts";
import { type RequestHandler, Router } from "express";
import { readCodexModels } from "../agents/codex-models";
import type { AgentChatService } from "../agents/service";
import type { AppConfig } from "../config";
import { handler } from "../http-errors";
import { param } from "./helpers";

const localHost = (hostname: string) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
const localAddress = (address: string | undefined) =>
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address ?? "");

/** CLI execution is a local capability, even when the rest of StructSmith is published. */
export function localAgentAccess(enabled: boolean): RequestHandler {
  return (req, res, next) => {
    const reject = () =>
      res.status(403).json({
        error: {
          code: "AGENT_CHAT_LOCAL_ONLY",
          message:
            "Agent chat requires an enabled local StructSmith server and a localhost browser origin.",
        },
      });
    if (!enabled || !localAddress(req.socket.remoteAddress)) {
      reject();
      return;
    }
    try {
      if (!localHost(new URL(`http://${req.get("host")}`).hostname)) {
        reject();
        return;
      }
      const origin = req.get("origin");
      if (origin) {
        const url = new URL(origin);
        if (!localHost(url.hostname) || !["http:", "https:"].includes(url.protocol)) {
          reject();
          return;
        }
      }
      if (req.get("sec-fetch-site") === "cross-site") {
        reject();
        return;
      }
    } catch {
      reject();
      return;
    }
    next();
  };
}

export function agentChatRoutes(service: AgentChatService, config: AppConfig): Router {
  const router = Router();
  router.get(
    "/settings",
    handler((_req, res) =>
      res.json({
        settings: service.getSettings(),
        availability: service.availability(),
        codexModels: readCodexModels(),
        readOnly: config.mcpReadOnly,
      } satisfies AgentSettingsResponse),
    ),
  );
  router.put(
    "/settings",
    handler((req, res) => res.json(service.setSettings(AgentSettingsSchema.parse(req.body)))),
  );
  router.get(
    "/chats",
    handler((_req, res) => res.json(service.list())),
  );
  router.post(
    "/chats",
    handler((req, res) =>
      res.status(201).json(service.create(CreateAgentChatSchema.parse(req.body))),
    ),
  );
  router.get(
    "/chats/:id",
    handler((req, res) => res.json(service.get(param(req, "id")))),
  );
  router.patch(
    "/chats/:id",
    handler((req, res) =>
      res.json(service.update(param(req, "id"), UpdateAgentChatSchema.parse(req.body))),
    ),
  );
  router.delete(
    "/chats/:id",
    handler((req, res) => {
      service.delete(param(req, "id"));
      res.status(204).end();
    }),
  );
  router.post(
    "/chats/:id/messages",
    handler((req, res) => {
      // Use the listening port, never an untrusted Host or forwarded header, for the injected MCP URL.
      const port = req.socket.localPort ?? config.port;
      res
        .status(202)
        .json(
          service.send(
            param(req, "id"),
            SendAgentMessageSchema.parse(req.body),
            `http://127.0.0.1:${port}`,
          ),
        );
    }),
  );
  router.post(
    "/chats/:id/stop",
    handler((req, res) => res.json(service.stop(param(req, "id")))),
  );
  return router;
}
