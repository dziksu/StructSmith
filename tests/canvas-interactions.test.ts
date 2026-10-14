import { describe, expect, test } from "bun:test";
import { buildGraph, computeCanvasBoundaries } from "../apps/web/src/features/canvas/graph";
import { boundaryDragPositions, startBoundaryDrag } from "../apps/web/src/features/canvas/movement";
import { modelDeletionRoots, selectionFromCanvas } from "../apps/web/src/features/canvas/selection";
import { createTestContext, createWorkspace } from "./helpers";

describe("canvas group interactions", () => {
  test("clearing real card selection preserves external inspectors but clears stale canvas selections", () => {
    expect(selectionFromCanvas([], [], { type: "boundary", id: "team" })).toEqual({
      type: "boundary",
      id: "team",
    });
    expect(selectionFromCanvas([], [], { type: "view", id: "view" })).toEqual({
      type: "view",
      id: "view",
    });
    expect(selectionFromCanvas([], [], { type: "record", id: "note" })).toEqual({
      type: "record",
      id: "note",
    });
    expect(selectionFromCanvas([], [], { type: "elements", ids: ["one", "two"] })).toEqual({
      type: "none",
    });
    expect(selectionFromCanvas([], [], { type: "relationship", id: "rel" })).toEqual({
      type: "none",
    });
    expect(selectionFromCanvas(["two", "one"], [], { type: "boundary", id: "team" })).toEqual({
      type: "elements",
      ids: ["one", "two"],
    });
    expect(selectionFromCanvas(["one"], [], { type: "boundary", id: "team" })).toEqual({
      type: "element",
      id: "one",
    });
    expect(selectionFromCanvas([], ["rel"], { type: "view", id: "view" })).toEqual({
      type: "relationship",
      id: "rel",
    });
  });

  test("moves nested visible members by one delta, preserving spacing and position locks", () => {
    const { services, close } = createTestContext();
    try {
      const workspace = createWorkspace(services);
      const elements = ["one", "two", "locked", "hidden", "outside"].map(
        (name) => services.elements.create(workspace.id, { kind: "container", name }).result,
      );
      const [one, two, locked, hidden, outside] = elements;
      if (!one || !two || !locked || !hidden || !outside) throw new Error("Missing fixture");
      const view = services.views.create(workspace.id, {
        kind: "custom",
        name: "Groups",
        elementIds: elements.map((element) => element.id),
      }).result;
      services.views.saveLayout(
        workspace.id,
        view.id,
        elements.map((element, index) => ({
          elementId: element.id,
          x: 101 + index * 233,
          y: 117 + index * 39,
          locked: element.id === locked.id,
          hidden: element.id === hidden.id,
        })),
      );
      const parent = services.boundaries.create(workspace.id, {
        viewId: view.id,
        kind: "custom",
        name: "Team",
        elementIds: [one.id, locked.id, hidden.id],
      }).result;
      services.boundaries.create(workspace.id, {
        viewId: view.id,
        parentBoundaryId: parent.id,
        kind: "custom",
        name: "Nested team",
        elementIds: [two.id],
      });
      const detail = services.views.get(view.id);
      const nodes = buildGraph({ view: detail, elements, relationships: [], records: [] }).nodes;
      const byId = new Map(elements.map((element) => [element.id, element]));
      const boundary = computeCanvasBoundaries(
        nodes.map((node) => ({
          id: node.id,
          x: node.position.x,
          y: node.position.y,
          width: 220,
          height: 96,
        })),
        byId,
        detail.boundaries,
        "deployment",
        true,
      ).semanticBoundaries.find((node) => node.data.boundaryId === parent.id);
      if (!boundary) throw new Error("Missing group");
      const drag = startBoundaryDrag(boundary, nodes);
      if (!drag) throw new Error("Missing group drag");
      const dx = 48;
      const dy = -32;
      const positions = boundaryDragPositions(drag, {
        x: boundary.position.x + dx,
        y: boundary.position.y + dy,
      });
      expect([...positions.keys()]).toEqual([one.id, two.id]);
      for (const id of [one.id, two.id]) {
        const original = nodes.find((node) => node.id === id)?.position;
        expect(positions.get(id)).toEqual({
          x: (original?.x ?? 0) + dx,
          y: (original?.y ?? 0) + dy,
        });
      }
      expect(boundaryDragPositions(drag, boundary.position)).toEqual(new Map(drag.members));
      expect(startBoundaryDrag(nodes[0] as (typeof nodes)[number], nodes)).toBeNull();

      // Persist and undo the entire gesture through the normal view layout service.
      services.views.saveLayout(
        workspace.id,
        view.id,
        [...positions].map(([elementId, position]) => ({ elementId, ...position })),
      );
      const moved = services.views.get(view.id);
      expect(moved.elements.find((entry) => entry.elementId === one.id)).toMatchObject({
        x: 149,
        y: 85,
      });
      expect(moved.elements.find((entry) => entry.elementId === locked.id)).toMatchObject({
        x: 567,
        y: 195,
      });
      expect(moved.elements.find((entry) => entry.elementId === hidden.id)).toMatchObject({
        x: 800,
        y: 234,
      });
      expect(moved.elements.find((entry) => entry.elementId === outside.id)).toMatchObject({
        x: 1033,
        y: 273,
      });
      services.views.saveLayout(
        workspace.id,
        view.id,
        [...drag.members].map(([elementId, position]) => ({ elementId, ...position })),
      );
      expect(services.views.get(view.id).elements).toEqual(detail.elements);
      const modelAfter = services.elements.list(workspace.id);
      for (const element of elements) {
        expect(modelAfter.find((item) => item.id === element.id)).toEqual(element);
      }
    } finally {
      close();
    }
  });

  test("bulk model deletion cascades selected ancestors once and remains undoable", () => {
    const { services, close } = createTestContext();
    try {
      const workspace = createWorkspace(services);
      const system = services.elements.create(workspace.id, {
        kind: "softwareSystem",
        name: "System",
      }).result;
      const container = services.elements.create(workspace.id, {
        kind: "container",
        name: "API",
        parentId: system.id,
      }).result;
      const component = services.elements.create(workspace.id, {
        kind: "component",
        name: "Handler",
        parentId: container.id,
      }).result;
      const neighbour = services.elements.create(workspace.id, {
        kind: "softwareSystem",
        name: "Neighbour",
      }).result;
      const byId = new Map(
        services.elements.list(workspace.id).map((element) => [element.id, element]),
      );
      const roots = modelDeletionRoots([component.id, system.id, neighbour.id, system.id], byId);
      expect(roots).toEqual([system.id, neighbour.id]);
      const result = services.model.applyOperations(
        workspace.id,
        {
          label: "Delete selection",
          operations: roots.map((elementId) => ({ op: "deleteElement", elementId, cascade: true })),
        },
        "ui",
      );
      expect(services.elements.list(workspace.id)).toEqual([]);
      services.snapshots.restore(result.snapshotId as string);
      expect(services.elements.list(workspace.id)).toHaveLength(4);
    } finally {
      close();
    }
  });
});
