import { describe, expect, test } from "bun:test";
import { computeLayout, toMermaid, validateDocument } from "@structsmith/domain";
import { computeSemanticBoundaries } from "../apps/web/src/features/canvas/graph";
import { createTestContext, createWorkspace } from "./helpers";

describe("semantic boundaries", () => {
  test("keeps boundary trees and memberships independent between views", () => {
    const { services, close } = createTestContext();
    try {
      const workspace = createWorkspace(services);
      const api = services.elements.create(workspace.id, {
        kind: "container",
        name: "API",
      }).result;
      const deployment = services.views.create(workspace.id, {
        kind: "deployment",
        name: "Production deployment",
        elementIds: [api.id],
      }).result;
      const security = services.views.create(workspace.id, {
        kind: "custom",
        name: "Security zones",
        elementIds: [api.id],
      }).result;
      const production = services.boundaries.create(workspace.id, {
        viewId: deployment.id,
        kind: "environment",
        name: "Production",
      }).result;
      const application = services.boundaries.create(workspace.id, {
        viewId: deployment.id,
        parentBoundaryId: production.id,
        kind: "networkZone",
        layer: "deployment",
        classification: "private",
        name: "Private application zone",
        elementIds: [api.id],
      }).result;
      const reassigned = services.boundaries.create(workspace.id, {
        viewId: deployment.id,
        parentBoundaryId: production.id,
        kind: "trustZone",
        layer: "deployment",
        classification: "restricted",
        name: "Restricted zone",
        elementIds: [api.id],
      }).result;
      services.boundaries.create(workspace.id, {
        viewId: deployment.id,
        kind: "complianceScope",
        layer: "compliance",
        name: "PCI scope",
        elementIds: [api.id],
      });
      const internet = services.boundaries.create(workspace.id, {
        viewId: security.id,
        kind: "trustZone",
        layer: "deployment",
        classification: "public",
        name: "Internet-facing",
        elementIds: [api.id],
      }).result;

      const document = services.model.getDocument(workspace.id);
      const boundaries = document.views.flatMap((view) => view.boundaries);
      expect(boundaries).toHaveLength(5);
      expect(boundaries.find((item) => item.id === application.id)?.elementIds).toEqual([]);
      expect(boundaries.find((item) => item.id === reassigned.id)?.elementIds).toEqual([api.id]);
      expect(boundaries.find((item) => item.id === internet.id)?.elementIds).toEqual([api.id]);
      expect(services.views.get(deployment.id).boundaries).toHaveLength(4);
      expect(services.views.get(security.id).boundaries).toHaveLength(1);
      expect(validateDocument(document).valid).toBe(true);
      expect("boundaries" in services.model.get(workspace.id)).toBe(false);

      services.views.setElements(workspace.id, deployment.id, [api.id], "remove");
      expect(
        services.views.get(deployment.id).boundaries.flatMap((boundary) => boundary.elementIds),
      ).toEqual([]);
      expect(services.views.get(security.id).boundaries[0]?.elementIds).toEqual([api.id]);

      const outside = services.elements.create(workspace.id, {
        kind: "container",
        name: "Outside this view",
      }).result;
      expect(() =>
        services.boundaries.create(workspace.id, {
          viewId: deployment.id,
          kind: "networkZone",
          name: "Invalid zone",
          elementIds: [outside.id],
        }),
      ).toThrow("must be added to the view");
    } finally {
      close();
    }
  });

  test("survives operation snapshots and appears in Mermaid export", () => {
    const { services, close } = createTestContext();
    try {
      const workspace = createWorkspace(services);
      const result = services.model.applyOperations(
        workspace.id,
        {
          label: "Create production topology",
          operations: [
            { op: "createElement", ref: "api", data: { kind: "container", name: "API" } },
            {
              op: "createView",
              ref: "deployment",
              data: {
                kind: "deployment",
                name: "Production deployment",
                elementIds: ["@api"],
              },
            },
            {
              op: "createBoundary",
              ref: "production",
              data: {
                viewId: "@deployment",
                kind: "environment",
                layer: "deployment",
                name: "Production",
              },
            },
            {
              op: "createBoundary",
              data: {
                viewId: "@deployment",
                parentBoundaryId: "@production",
                kind: "networkZone",
                layer: "deployment",
                classification: "private",
                name: "Private application zone",
                elementIds: ["@api"],
              },
            },
          ],
        },
        "mcp",
      );

      const document = services.model.getDocument(workspace.id);
      expect(document.views[0]?.boundaries).toHaveLength(2);
      expect(toMermaid(document, { view: document.views[0] })).toContain("subgraph");
      expect(toMermaid(document, { view: document.views[0] })).toContain(
        "Private application zone",
      );

      const withBoundaries = services.snapshots.create(workspace.id, "With view boundaries");
      services.boundaries.delete(workspace.id, document.views[0]?.boundaries[0]?.id as string, {
        cascade: true,
      });
      expect(services.views.get(document.views[0]?.id as string).boundaries).toEqual([]);
      services.snapshots.restore(withBoundaries.id);
      expect(services.views.get(document.views[0]?.id as string).boundaries).toHaveLength(2);

      services.snapshots.restore(result.snapshotId as string);
      expect(
        services.model.getDocument(workspace.id).views.flatMap((view) => view.boundaries),
      ).toEqual([]);
    } finally {
      close();
    }
  });

  test("derives nested canvas rectangles and compound Dagre groups", () => {
    const boundaries = [
      {
        id: "production",
        workspaceId: "workspace",
        viewId: "view",
        parentBoundaryId: null,
        kind: "environment" as const,
        layer: "deployment" as const,
        classification: null,
        name: "Production",
        description: null,
        tags: [],
        properties: {},
        elementIds: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "private",
        workspaceId: "workspace",
        viewId: "view",
        parentBoundaryId: "production",
        kind: "networkZone" as const,
        layer: "deployment" as const,
        classification: "private" as const,
        name: "Private zone",
        description: null,
        tags: [],
        properties: {},
        elementIds: ["api", "database"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const rendered = computeSemanticBoundaries(
      [
        { id: "api", x: 100, y: 100, width: 220, height: 96 },
        { id: "database", x: 500, y: 100, width: 220, height: 96 },
      ],
      boundaries,
      "deployment",
      true,
    );
    expect(rendered.map((node) => node.id)).toEqual(["boundary:production", "boundary:private"]);
    const production = rendered[0]?.style as { width: number; height: number };
    const privateZone = rendered[1]?.style as { width: number; height: number };
    expect(production.width).toBeGreaterThan(privateZone.width);
    expect(production.height).toBeGreaterThan(privateZone.height);
    // React Flow uses the node fields, rather than CSS dimensions, to decide
    // whether a custom node can become visible.
    expect(rendered[0]?.width).toBe(production.width);
    expect(rendered[0]?.height).toBe(production.height);
    expect(rendered[1]?.width).toBe(privateZone.width);
    expect(rendered[1]?.height).toBe(privateZone.height);

    const positions = computeLayout(
      [
        { id: "api", groupId: "private" },
        { id: "database", groupId: "private" },
        { id: "client", groupId: "public" },
      ],
      [
        { source: "client", target: "api" },
        { source: "api", target: "database" },
      ],
      "LR",
      "dagre",
      undefined,
      [
        { id: "production" },
        { id: "private", parentId: "production" },
        { id: "public", parentId: "production" },
      ],
    );
    expect(positions).toHaveLength(3);
    expect(positions.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    const byId = new Map(positions.map((position) => [position.id, position] as const));
    const client = byId.get("client");
    const api = byId.get("api");
    const database = byId.get("database");
    if (!client || !api || !database) throw new Error("Missing compound layout position");
    const privateMinX = Math.min(api.x, database.x);
    const privateMaxX = Math.max(api.x, database.x) + 220;
    const privateMinY = Math.min(api.y, database.y);
    const privateMaxY = Math.max(api.y, database.y) + 96;
    const separated =
      client.x + 220 < privateMinX ||
      client.x > privateMaxX ||
      client.y + 96 < privateMinY ||
      client.y > privateMaxY;
    expect(separated).toBe(true);
  });
});
