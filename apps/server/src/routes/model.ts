import {
  AutoLayoutRequestSchema,
  CreateElementSchema,
  CreateRecordSchema,
  CreateRelationshipSchema,
  CreateViewSchema,
  CreateSnapshotRequestSchema,
  ERROR_CODES,
  UpdateElementSchema,
  UpdateLayoutRequestSchema,
  UpdateRecordSchema,
  UpdateRelationshipSchema,
  UpdateViewSchema,
} from "@structsmith/contracts";
import { DomainError, type Services } from "@structsmith/domain";
import { Router } from "express";
import { z } from "zod";
import { handler } from "../http-errors";
import { mutationOptions, param } from "./helpers";

/**
 * The REST surface mirrors spec §18: entities are addressed by their own id,
 * the owning workspace is resolved on the server.
 */
export function modelRoutes(services: Services): Router {
  const router = Router();
  const store = services.context.store;

  const workspaceOfElement = (id: string): string => {
    const element = store.elements.findById(id);
    if (!element) {
      throw new DomainError(ERROR_CODES.ELEMENT_NOT_FOUND, `Element "${id}" does not exist.`, 404);
    }
    return element.workspaceId;
  };

  const workspaceOfRelationship = (id: string): string => {
    const relationship = store.relationships.findById(id);
    if (!relationship) {
      throw new DomainError(
        ERROR_CODES.RELATIONSHIP_NOT_FOUND,
        `Relationship "${id}" does not exist.`,
        404,
      );
    }
    return relationship.workspaceId;
  };

  const workspaceOfView = (id: string): string => {
    const view = store.views.findById(id);
    if (!view) {
      throw new DomainError(ERROR_CODES.VIEW_NOT_FOUND, `View "${id}" does not exist.`, 404);
    }
    return view.workspaceId;
  };

  const workspaceOfRecord = (id: string): string => {
    const record = store.records.findById(id);
    if (!record) {
      throw new DomainError(ERROR_CODES.RECORD_NOT_FOUND, `Record "${id}" does not exist.`, 404);
    }
    return record.workspaceId;
  };

  /* ------------------------------ elements ------------------------------ */

  router.get(
    "/workspaces/:id/elements",
    handler((req, res) => res.json({ elements: services.elements.list(param(req, "id")) })),
  );

  router.post(
    "/workspaces/:id/elements",
    handler((req, res) =>
      res
        .status(201)
        .json(
          services.elements.create(
            param(req, "id"),
            CreateElementSchema.parse(req.body),
            mutationOptions(req),
          ),
        ),
    ),
  );

  router.patch(
    "/elements/:id",
    handler((req, res) => {
      const id = param(req, "id");
      res.json(
        services.elements.update(
          workspaceOfElement(id),
          id,
          UpdateElementSchema.parse(req.body),
          mutationOptions(req),
        ),
      );
    }),
  );

  router.delete(
    "/elements/:id",
    handler((req, res) => {
      const id = param(req, "id");
      const cascade = req.query.cascade !== "false";
      res.json(
        services.elements.delete(workspaceOfElement(id), id, { ...mutationOptions(req), cascade }),
      );
    }),
  );

  /* --------------------------- relationships ---------------------------- */

  router.get(
    "/workspaces/:id/relationships",
    handler((req, res) =>
      res.json({ relationships: services.relationships.list(param(req, "id")) }),
    ),
  );

  router.post(
    "/workspaces/:id/relationships",
    handler((req, res) =>
      res
        .status(201)
        .json(
          services.relationships.create(
            param(req, "id"),
            CreateRelationshipSchema.parse(req.body),
            mutationOptions(req),
          ),
        ),
    ),
  );

  router.patch(
    "/relationships/:id",
    handler((req, res) => {
      const id = param(req, "id");
      res.json(
        services.relationships.update(
          workspaceOfRelationship(id),
          id,
          UpdateRelationshipSchema.parse(req.body),
          mutationOptions(req),
        ),
      );
    }),
  );

  router.delete(
    "/relationships/:id",
    handler((req, res) => {
      const id = param(req, "id");
      res.json(services.relationships.delete(workspaceOfRelationship(id), id, mutationOptions(req)));
    }),
  );

  /* -------------------------------- views ------------------------------- */

  router.get(
    "/workspaces/:id/views",
    handler((req, res) => {
      const workspaceId = param(req, "id");
      const views =
        req.query.include === "elements"
          ? services.views.listDetailed(workspaceId)
          : services.views.list(workspaceId);
      res.json({ views });
    }),
  );

  router.post(
    "/workspaces/:id/views",
    handler((req, res) =>
      res
        .status(201)
        .json(
          services.views.create(
            param(req, "id"),
            CreateViewSchema.parse(req.body),
            mutationOptions(req),
          ),
        ),
    ),
  );

  router.get(
    "/views/:id",
    handler((req, res) => res.json(services.views.get(param(req, "id")))),
  );

  router.patch(
    "/views/:id",
    handler((req, res) => {
      const id = param(req, "id");
      res.json(
        services.views.update(
          workspaceOfView(id),
          id,
          UpdateViewSchema.parse(req.body),
          mutationOptions(req),
        ),
      );
    }),
  );

  router.delete(
    "/views/:id",
    handler((req, res) => {
      const id = param(req, "id");
      res.json(services.views.delete(workspaceOfView(id), id, mutationOptions(req)));
    }),
  );

  /** Batch layout write, called once a drag gesture settles (spec §18). */
  router.patch(
    "/views/:id/layout",
    handler((req, res) => {
      const id = param(req, "id");
      const request = UpdateLayoutRequestSchema.parse(req.body);
      res.json(
        services.views.saveLayout(
          workspaceOfView(id),
          id,
          request.entries,
          request.relationships,
          mutationOptions(req),
        ),
      );
    }),
  );

  router.post(
    "/views/:id/elements",
    handler((req, res) => {
      const id = param(req, "id");
      const request = z
        .object({
          elementIds: z.array(z.string()).min(1),
          mode: z.enum(["replace", "add", "remove"]).default("add"),
        })
        .parse(req.body);
      res.json(
        services.views.setElements(
          workspaceOfView(id),
          id,
          request.elementIds,
          request.mode,
          mutationOptions(req),
        ),
      );
    }),
  );

  router.post(
    "/views/:id/auto-layout",
    handler((req, res) => {
      const id = param(req, "id");
      const request = AutoLayoutRequestSchema.parse(req.body ?? {});
      res.json(
        services.views.autoLayout(workspaceOfView(id), id, request.direction, mutationOptions(req)),
      );
    }),
  );

  /* ------------------------------- records ------------------------------ */

  router.get(
    "/workspaces/:id/records",
    handler((req, res) => res.json({ records: services.records.list(param(req, "id")) })),
  );

  router.post(
    "/workspaces/:id/records",
    handler((req, res) =>
      res
        .status(201)
        .json(
          services.records.create(
            param(req, "id"),
            CreateRecordSchema.parse(req.body),
            mutationOptions(req),
          ),
        ),
    ),
  );

  router.patch(
    "/records/:id",
    handler((req, res) => {
      const id = param(req, "id");
      res.json(
        services.records.update(
          workspaceOfRecord(id),
          id,
          UpdateRecordSchema.parse(req.body),
          mutationOptions(req),
        ),
      );
    }),
  );

  router.delete(
    "/records/:id",
    handler((req, res) => {
      const id = param(req, "id");
      res.json(services.records.delete(workspaceOfRecord(id), id, mutationOptions(req)));
    }),
  );

  /* ------------------------------ snapshots ----------------------------- */

  router.get(
    "/workspaces/:id/snapshots",
    handler((req, res) => res.json({ snapshots: services.snapshots.list(param(req, "id")) })),
  );

  router.post(
    "/workspaces/:id/snapshots",
    handler((req, res) => {
      const request = CreateSnapshotRequestSchema.parse(req.body ?? {});
      res
        .status(201)
        .json(services.snapshots.create(param(req, "id"), request.label, request.source));
    }),
  );

  router.post(
    "/snapshots/:id/restore",
    handler((req, res) => res.json(services.snapshots.restore(param(req, "id"), "ui"))),
  );

  return router;
}
