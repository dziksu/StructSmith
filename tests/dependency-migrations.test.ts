import { describe, expect, test } from "bun:test";
import { CreateViewSchema, UpdateViewSchema, ViewSettingsSchema } from "@structsmith/contracts";
import { computeLayout } from "@structsmith/domain";
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
    });
  });

  test("updating one setting preserves the other saved settings", () => {
    const { services, close } = createTestContext();
    try {
      const workspace = createWorkspace(services);
      const view = services.views.create(workspace.id, {
        name: "Context",
        kind: "systemContext",
        settings: { showBoundaries: false, snapToGrid: false, autoLayoutDirection: "TB" },
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
});
