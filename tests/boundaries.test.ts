import { describe, expect, test } from "bun:test";
import { computeLayout, toMermaid, validateDocument } from "@structsmith/domain";
import { computeSemanticBoundaries } from "../apps/web/src/features/canvas/graph";
import { createTestContext, createWorkspace } from "./helpers";

describe("semantic boundaries", () => {
  test("persist nested boundaries and keep one membership per layer", () => {
    const { services, close } = createTestContext();
    try {
      const workspace = createWorkspace(services);
      const api = services.elements.create(workspace.id, {
        kind: "container",
        name: "API",
      }).result;
      const production = services.boundaries.create(workspace.id, {
        kind: "environment",
        name: "Production",
      }).result;
      const application = services.boundaries.create(workspace.id, {
        parentBoundaryId: production.id,
        kind: "networkZone",
        layer: "deployment",
        classification: "private",
        name: "Private application zone",
        elementIds: [api.id],
      }).result;
      const reassigned = services.boundaries.create(workspace.id, {
        parentBoundaryId: production.id,
        kind: "trustZone",
        layer: "deployment",
        classification: "restricted",
        name: "Restricted zone",
        elementIds: [api.id],
      }).result;
      services.boundaries.create(workspace.id, {
        kind: "complianceScope",
        layer: "compliance",
        name: "PCI scope",
        elementIds: [api.id],
      });

      const document = services.model.getDocument(workspace.id);
      const boundaries = document.boundaries ?? [];
      expect(boundaries).toHaveLength(4);
      expect(boundaries.find((item) => item.id === application.id)?.elementIds).toEqual([]);
      expect(boundaries.find((item) => item.id === reassigned.id)?.elementIds).toEqual([api.id]);
      expect(validateDocument(document).valid).toBe(true);
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
              op: "createBoundary",
              ref: "production",
              data: { kind: "environment", layer: "deployment", name: "Production" },
            },
            {
              op: "createBoundary",
              data: {
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
      expect(document.boundaries).toHaveLength(2);
      expect(toMermaid(document)).toContain("subgraph");
      expect(toMermaid(document)).toContain("Private application zone");

      services.snapshots.restore(result.snapshotId as string);
      expect(services.model.getDocument(workspace.id).boundaries).toEqual([]);
    } finally {
      close();
    }
  });

  test("derives nested canvas rectangles and compound Dagre groups", () => {
    const boundaries = [
      {
        id: "production",
        workspaceId: "workspace",
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
