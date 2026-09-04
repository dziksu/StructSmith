import type { ChangeSource } from "@structsmith/contracts";
import type { Request } from "express";
import { z } from "zod";

const revisionSchema = z.coerce.number().int().nonnegative().optional();

/** `expectedRevision` may arrive in the body (writes) or the query (deletes). */
export function readExpectedRevision(req: Request): number | undefined {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return revisionSchema.parse(body.expectedRevision ?? req.query.expectedRevision ?? undefined);
}

export function mutationOptions(req: Request): { expectedRevision?: number; source: ChangeSource } {
  return { expectedRevision: readExpectedRevision(req), source: "ui" };
}

export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) throw new Error(`Missing route parameter "${name}".`);
  return value;
}
