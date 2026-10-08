import { expect, test } from "bun:test";
import { ViewRelationshipPatchSchema, WorkspaceDocumentSchema } from "@structsmith/contracts";
import { getBezierPath, getSmoothStepPath, Position } from "@xyflow/react";
import { createTestContext, createWorkspace } from "../../../../../tests/helpers";
import { buildGraph } from "./graph";
import { pathThroughControlPoints, pointOnRelationshipPath } from "./relationshipGeometry";

test("normalized label positions follow rendered path length, including orthogonal elbows and curves", () => {
  const path = "M0,0 L100,0 L100,300";
  expect(pointOnRelationshipPath(path, 0.22)).toEqual({ x: 88, y: 0 });
  expect(pointOnRelationshipPath(path, 0.78)).toEqual({ x: 100, y: 212 });
  expect(pointOnRelationshipPath(path, 0)).toEqual({ x: 0, y: 0 });
  expect(pointOnRelationshipPath(path, 1)).toEqual({ x: 100, y: 300 });
  const options = {
    sourceX: 20,
    sourceY: 40,
    targetX: 400,
    targetY: 300,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
  for (const [rendered] of [getSmoothStepPath(options), getBezierPath(options)]) {
    expect(pointOnRelationshipPath(rendered, 0)).toEqual({ x: 20, y: 40 });
    expect(pointOnRelationshipPath(rendered, 1).x).toBeCloseTo(400);
    expect(pointOnRelationshipPath(rendered, 1).y).toBeCloseTo(300);
    expect(pointOnRelationshipPath(rendered, 0.22)).not.toEqual(
      pointOnRelationshipPath(rendered, 0.78),
    );
  }
  const manual = pathThroughControlPoints(
    { x: 0, y: 0 },
    { x: 200, y: 100 },
    Position.Right,
    Position.Top,
    [{ x: 80, y: 60 }],
    true,
  );
  expect(manual).toStartWith("M0,0 L24,0");
  expect(manual).toEndWith("L200,76 L200,100");
  expect(manual).toContain("L80,60");
});

test("relationship presentation is view-owned, guarded, previewable, portable and undoable", () => {
  const { services, close } = createTestContext();
  try {
    const workspace = createWorkspace(services);
    const source = services.elements.create(workspace.id, {
      name: "Portal",
      kind: "softwareSystem",
    }).result;
    const target = services.elements.create(workspace.id, {
      name: "Review",
      kind: "softwareSystem",
    }).result;
    const relationship = services.relationships.create(workspace.id, {
      sourceElementId: source.id,
      targetElementId: target.id,
      description: "Yes",
      interactionStyle: "sync",
    }).result;
    const views = ["Workflow", "Runtime"].map(
      (name) =>
        services.views.create(workspace.id, {
          name,
          kind: "custom",
          elementIds: [source.id, target.id],
        }).result,
    );
    const view = views[0];
    const other = views[1];
    if (!view || !other) throw new Error("Missing views");
    const originalDocument = services.model.getDocument(workspace.id);
    const revision = services.workspaces.get(workspace.id).revision;
    const presentation = {
      sourceSide: "right" as const,
      targetSide: "left" as const,
      color: "#22c55e",
      strokeWidth: 3,
      lineStyle: "dashed" as const,
      startArrow: "open" as const,
      endArrow: "closed" as const,
      legendLabel: "Success",
      labelPosition: 0.22,
      labelOffset: { x: -40, y: 20 },
      controlPoints: [{ x: 300, y: 160 }],
    };
    const command = {
      expectedRevision: revision,
      operations: [
        {
          op: "setViewRelationships" as const,
          viewId: view.id,
          relationships: [{ relationshipId: relationship.id, ...presentation }],
        },
      ],
    };
    expect(services.model.previewOperations(workspace.id, command).persisted).toBe(false);
    expect(services.model.getDocument(workspace.id)).toEqual(originalDocument);
    const applied = services.model.applyOperations(workspace.id, command, "mcp");
    expect(() => services.model.applyOperations(workspace.id, command, "mcp")).toThrow(
      "modified by someone else",
    );
    expect(services.views.get(view.id).relationships[0]).toMatchObject(presentation);
    expect(services.views.get(view.id).elements).toEqual(view.elements);
    expect(services.model.get(workspace.id).relationships).toEqual([relationship]);
    expect(services.views.get(other.id).relationships).toEqual([]);
    const graph = buildGraph({
      view: services.views.get(view.id),
      elements: [source, target],
      relationships: [relationship],
      records: [],
    });
    expect(graph.edges[0]).toMatchObject({
      sourceHandle: "r",
      targetHandle: "l",
      reconnectable: true,
      data: { placement: presentation },
    });

    const document = WorkspaceDocumentSchema.parse(services.model.getDocument(workspace.id));
    const imported = services.imports.importDocument(document);
    expect(services.views.listDetailed(imported.id)[0]?.relationships[0]).toMatchObject(
      presentation,
    );
    services.views.autoLayout(workspace.id, view.id, "TB");
    expect(services.views.get(view.id).relationships[0]).toMatchObject(presentation);
    if (!applied.snapshotId) throw new Error("Missing snapshot");
    services.snapshots.restore(applied.snapshotId);
    expect(services.views.get(view.id).relationships).toEqual([]);
    expect(services.model.get(workspace.id).relationships).toEqual([relationship]);

    services.views.saveLayout(
      workspace.id,
      view.id,
      [],
      [
        { relationshipId: relationship.id, color: "#ff0000" },
        { relationshipId: relationship.id, labelPosition: 0.78 },
      ],
    );
    expect(services.views.get(view.id).relationships[0]).toMatchObject({
      color: "#ff0000",
      labelPosition: 0.78,
    });
    services.views.saveLayout(
      workspace.id,
      view.id,
      [],
      [{ relationshipId: relationship.id, color: null, labelPosition: null }],
    );
    expect(services.views.get(view.id).relationships[0]).toMatchObject({
      color: null,
      labelPosition: null,
    });
    // Old documents contain only the original relationship-placement fields.
    const legacy = services.model.getDocument(workspace.id);
    legacy.views = legacy.views.map((candidate) => ({
      ...candidate,
      relationships: candidate.relationships.map(
        ({ viewId, relationshipId, hidden, labelPosition, controlPoints }) => ({
          viewId,
          relationshipId,
          hidden,
          labelPosition,
          controlPoints,
        }),
      ),
    }));
    expect(() =>
      services.imports.importDocument(WorkspaceDocumentSchema.parse(legacy)),
    ).not.toThrow();
  } finally {
    close();
  }
});

test("invalid presentation and cross-workspace references do not write partial changes", () => {
  const { services, close } = createTestContext();
  try {
    const workspace = createWorkspace(services);
    const other = createWorkspace(services, "Other");
    const source = services.elements.create(other.id, { name: "A", kind: "custom" }).result;
    const target = services.elements.create(other.id, { name: "B", kind: "custom" }).result;
    const relationship = services.relationships.create(other.id, {
      sourceElementId: source.id,
      targetElementId: target.id,
    }).result;
    const view = services.views.create(workspace.id, { name: "View", kind: "custom" }).result;
    const original = services.model.getDocument(workspace.id);
    expect(() =>
      services.views.saveLayout(
        workspace.id,
        view.id,
        [],
        [{ relationshipId: relationship.id, color: "#22c55e" }],
      ),
    ).toThrow("does not exist");
    expect(services.model.getDocument(workspace.id)).toEqual(original);
    for (const patch of [
      { labelPosition: -0.1 },
      { labelPosition: 1.1 },
      { color: "red" },
      { strokeWidth: 0 },
      { strokeWidth: 9 },
      { sourceSide: "center" },
    ]) {
      expect(
        ViewRelationshipPatchSchema.safeParse({ relationshipId: relationship.id, ...patch })
          .success,
      ).toBe(false);
    }
  } finally {
    close();
  }
});
