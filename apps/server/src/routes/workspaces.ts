import {
  ApplyOperationsRequestSchema,
  CreateWorkspaceSchema,
  ImportWorkspaceRequestSchema,
  UpdateWorkspaceSchema,
} from "@structsmith/contracts";
import type { Services } from "@structsmith/domain";
import { Router } from "express";
import { handler } from "../http-errors";
import { mutationOptions, param } from "./helpers";

export function workspaceRoutes(services: Services): Router {
  const router = Router();

  router.get(
    "/workspaces",
    handler((_req, res) => res.json({ workspaces: services.workspaces.list() })),
  );

  router.post(
    "/workspaces",
    handler((req, res) =>
      res.status(201).json(services.workspaces.create(CreateWorkspaceSchema.parse(req.body))),
    ),
  );

  router.get(
    "/workspaces/:id",
    handler((req, res) => res.json(services.workspaces.get(param(req, "id")))),
  );

  router.patch(
    "/workspaces/:id",
    handler((req, res) =>
      res.json(
        services.workspaces.update(
          param(req, "id"),
          UpdateWorkspaceSchema.parse(req.body),
          mutationOptions(req),
        ),
      ),
    ),
  );

  router.delete(
    "/workspaces/:id",
    handler((req, res) => {
      services.workspaces.delete(param(req, "id"));
      res.status(204).end();
    }),
  );

  /* ------------------------------- model -------------------------------- */

  router.get(
    "/workspaces/:id/model",
    handler((req, res) => res.json(services.model.get(param(req, "id")))),
  );

  router.get(
    "/workspaces/:id/document",
    handler((req, res) => res.json(services.model.getDocument(param(req, "id")))),
  );

  router.get(
    "/workspaces/:id/validate",
    handler((req, res) => res.json(services.model.validate(param(req, "id")))),
  );

  router.get(
    "/workspaces/:id/activity",
    handler((req, res) =>
      res.json({ activity: services.activity.list(param(req, "id"), Number(req.query.limit ?? 100)) }),
    ),
  );

  router.get(
    "/workspaces/:id/export/mermaid",
    handler((req, res) => {
      const viewId = typeof req.query.viewId === "string" ? req.query.viewId : undefined;
      res.type("text/plain").send(services.model.exportMermaid(param(req, "id"), viewId));
    }),
  );

  /** Atomic batch of operations — the same path MCP uses (spec §19). */
  router.post(
    "/workspaces/:id/commands",
    handler((req, res) => {
      const command = ApplyOperationsRequestSchema.parse(req.body);
      res.json(
        services.model.applyOperations(
          param(req, "id"),
          {
            expectedRevision: command.expectedRevision,
            label: command.label,
            operations: command.operations,
          },
          "ui",
        ),
      );
    }),
  );

  router.post(
    "/workspaces/import",
    handler((req, res) => {
      const request = ImportWorkspaceRequestSchema.parse(req.body);
      res.status(201).json(
        services.imports.importDocument(request.document, {
          mode: request.mode,
          name: request.name,
        }),
      );
    }),
  );

  return router;
}
