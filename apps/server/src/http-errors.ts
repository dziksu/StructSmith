import { ERROR_CODES } from "@structsmith/contracts";
import { DomainError } from "@structsmith/domain";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

/** Wraps async handlers so rejected promises reach the error middleware. */
export const handler =
  (fn: (req: Request, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    try {
      const result = fn(req, res);
      if (result instanceof Promise) result.catch(next);
    } catch (error) {
      next(error);
    }
  };

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: "The request payload is invalid.",
        details: error.flatten(),
      },
    });
    return;
  }

  if (error instanceof DomainError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  console.error("[server] unhandled error:", error);
  res.status(500).json({ error: { code: ERROR_CODES.INTERNAL, message } });
}
