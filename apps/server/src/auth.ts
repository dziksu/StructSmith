import { ERROR_CODES } from "@structsmith/contracts";
import type { RequestHandler } from "express";
import type { AppConfig } from "./config";

/**
 * Local mode has no auth at all (spec §52). Token mode protects /api and /mcp;
 * /health always stays public.
 */
export function createAuthMiddleware(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    if (config.authMode === "none") {
      next();
      return;
    }

    if (!config.appToken) {
      res.status(500).json({
        error: {
          code: ERROR_CODES.INTERNAL,
          message: "AUTH_MODE=token requires APP_TOKEN to be set.",
        },
      });
      return;
    }

    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (token !== config.appToken) {
      res.status(401).json({
        error: { code: ERROR_CODES.UNAUTHORIZED, message: "A valid bearer token is required." },
      });
      return;
    }

    next();
  };
}
