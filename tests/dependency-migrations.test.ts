import { describe, expect, test } from "bun:test";
import { CreateViewSchema, UpdateViewSchema, ViewSettingsSchema } from "@structsmith/contracts";
import { computeLayout } from "@structsmith/domain";
import { buildGraph } from "../apps/web/src/features/canvas/graph";
import { createTestContext, createWorkspace } from "./helpers";

describe("Zod view settings", () => {
  test("partial settings do not acquire defaults when parsed", () => {
    expect(UpdateViewSchema.parse({ settings: {} })).toEqual({ settings: {} });
    expect(UpdateViewSchema.parse({ settings: { snapToGrid: true } })).toEqual({
      settings: { snapToGrid: true },
    });
    expect(
      CreateViewSchema.parse({ name: "Context", kind: "systemContext", settings: {} }),
    ).toMatchObject({ settings: {} });
    expect(ViewSettingsSchema.parse({})).toEqual({
      showBoundaries: true,
      snapToGrid: false,
      autoLayoutDirection: "LR",
      autoLayoutAlgorithm: "dagre",
      boundaryLayer: "deployment",
      relationshipRouting: "orthogonal",
      showRelationshipLabels: true,
      showFullTitles: false,
      showDescriptions: false,
    });
  });

  test("updating one setting preserves the other saved settings", () => {
    const { services, close } = createTestContext();
    try {
      const workspace = createWorkspace(services);
      const view = services.views.create(workspace.id, {
        name: "Context",
        kind: "systemContext",
        settings: {
          showBoundaries: false,
          snapToGrid: false,
          autoLayoutDirection: "TB",
          autoLayoutAlgorithm: "dagre",
          boundaryLayer: "deployment",
          relationshipRouting: "straight",
          showRelationshipLabels: false,
          showFullTitles: true,
          showDescriptions: true,
        },
      }).result;
      services.views.update(
        workspace.id,
        view.id,
        UpdateViewSchema.parse({ settings: { snapToGrid: true } }),
      );
      expect(services.views.get(view.id).settings).toEqual({
        showBoundaries: false,
        snapToGrid: true,
        autoLayoutDirection: "TB",
        autoLayoutAlgorithm: "dagre",
        boundaryLayer: "deployment",
        relationshipRouting: "straight",
        showRelationshipLabels: false,
        showFullTitles: true,
        showDescriptions: true,
      });
    } finally {
      close();
    }
  });
});

describe("Dagre layout", () => {
  test("keeps direction and finite coordinates for both orientations", () => {
    expect(computeLayout([], [])).toEqual([]);
    for (const direction of ["LR", "TB"] as const) {
      const positions = computeLayout(
        [{ id: "a" }, { id: "b" }],
        [{ source: "a", target: "b", label: "Calls API" }],
        direction,
      );
      const first = positions[0];
      const second = positions[1];
      if (!first || !second) throw new Error("Missing layout nodes");
      expect(direction === "LR" ? second.x > first.x : second.y > first.y).toBe(true);
      for (const position of positions) {
        expect(Number.isFinite(position.x) && Number.isFinite(position.y)).toBe(true);
      }
    }
  });

  test("handles detached parent clusters deterministically", () => {
    const nodes = [{ id: "a", parentId: "system" }, { id: "b", parentId: "system" }, { id: "c" }];
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const positions = computeLayout(nodes, edges);
    expect(positions.map((position) => position.id)).toEqual(["a", "b", "c"]);
    expect(computeLayout(nodes, edges)).toEqual(positions);
    for (const position of positions) {
      expect(Number.isFinite(position.x) && Number.isFinite(position.y)).toBe(true);
    }
  });

  test("ignores edges to visible parent clusters", () => {
    const nodes = [
      { id: "system" },
      { id: "api", parentId: "system" },
      { id: "database", parentId: "system" },
      { id: "customer" },
    ];
    const edges = [
      { source: "customer", target: "system" },
      { source: "system", target: "database" },
      { source: "api", target: "database" },
    ];

    for (const direction of ["LR", "TB"] as const) {
      const positions = computeLayout(nodes, edges, direction, "dagre");
      expect(positions.map((position) => position.id)).toEqual([
        "system",
        "api",
        "database",
        "customer",
      ]);
      expect(positions.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
      const byId = new Map(positions.map((position) => [position.id, position] as const));
      const api = byId.get("api");
      const database = byId.get("database");
      if (!api || !database) throw new Error("Missing child layout positions");
      expect(direction === "LR" ? database.x > api.x : database.y > api.y).toBe(true);
    }
  });
});

describe("Canvas relationship presentation", () => {
  test("maps view routing, label visibility and direction to rendered edges", () => {
    const { services, close } = createTestContext();
    try {
      const workspace = createWorkspace(services);
      const source = services.elements.create(workspace.id, {
        kind: "container",
        name: "Source",
      }).result;
      const target = services.elements.create(workspace.id, {
        kind: "container",
        name: "Target",
      }).result;
      services.relationships.create(workspace.id, {
        sourceElementId: source.id,
        targetElementId: target.id,
        description: "Calls",
      });
      const view = services.views.create(workspace.id, {
        name: "Containers",
        kind: "container",
        elementIds: [source.id, target.id],
        settings: {
          autoLayoutDirection: "TB",
          relationshipRouting: "curved",
          showRelationshipLabels: false,
        },
      }).result;
      const model = services.model.get(workspace.id);

      const graph = buildGraph({
        view: services.views.get(view.id),
        elements: model.elements,
        relationships: model.relationships,
        records: [],
      });

      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({
        sourceHandle: "b",
        targetHandle: "t",
        data: { routing: "curved", showLabel: false, label: "Calls" },
      });
    } finally {
      close();
    }
  });
});
