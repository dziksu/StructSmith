import { expect, test } from "bun:test";
import { UpdateViewSchema } from "@structsmith/contracts";
import { buildGraph } from "../apps/web/src/features/canvas/graph";
import { relationshipFocus } from "../apps/web/src/features/canvas/RelationshipEdge";
import { createTestContext, createWorkspace } from "./helpers";

test("selecting an element emphasizes only its directly connected relationships", () => {
  expect(relationshipFocus(null, "a", "b")).toBe("normal");
  expect(relationshipFocus("a", "a", "b")).toBe("connected");
  expect(relationshipFocus("b", "a", "b")).toBe("connected");
  expect(relationshipFocus("c", "a", "b")).toBe("dimmed");
});

test("presentation switches are independent, scoped to a view and undoable without moving cards", () => {
  const { services, close } = createTestContext();
  try {
    const workspace = createWorkspace(services);
    const element = services.elements.create(workspace.id, {
      kind: "container",
      name: "Shared platform backend for accounts, documents and notifications",
      description: "Manages accounts and permissions.\nDelivers documents and notifications.",
    }).result;
    const view = services.views.create(workspace.id, {
      name: "Detailed view",
      kind: "container",
      elementIds: [element.id],
    }).result;
    const other = services.views.create(workspace.id, {
      name: "Compact view",
      kind: "container",
      elementIds: [element.id],
    }).result;
    const originalPlacement = services.views.get(view.id).elements;
    const update = (settings: { showFullTitles?: boolean; showDescriptions?: boolean }) =>
      services.model.applyOperations(
        workspace.id,
        {
          operations: [
            { op: "updateView", viewId: view.id, data: UpdateViewSchema.parse({ settings }) },
          ],
        },
        "ui",
      );
    const graph = () =>
      buildGraph({
        view: services.views.get(view.id),
        elements: [element],
        relationships: [],
        records: [],
      });

    update({ showFullTitles: true });
    expect(graph().nodes[0]?.data).toMatchObject({ showFullTitles: true, showDescriptions: false });
    update({ showDescriptions: true });
    expect(graph().nodes[0]?.data).toMatchObject({ showFullTitles: true, showDescriptions: true });
    const changed = update({ showFullTitles: false });
    expect(graph().nodes[0]?.data).toMatchObject({ showFullTitles: false, showDescriptions: true });
    expect(services.views.get(other.id).settings).toMatchObject({
      showFullTitles: false,
      showDescriptions: false,
    });
    expect(services.views.get(view.id).elements).toEqual(originalPlacement);

    if (!changed.snapshotId) throw new Error("Expected an undo snapshot");
    services.snapshots.restore(changed.snapshotId);
    expect(services.views.get(view.id).settings).toMatchObject({
      showFullTitles: true,
      showDescriptions: true,
    });
    update({ showFullTitles: false, showDescriptions: false });
    expect(graph().nodes[0]).toMatchObject({ width: 220, height: 96 });
    expect(services.views.get(view.id).elements).toEqual(originalPlacement);
  } finally {
    close();
  }
});

test("auto layout reserves space for expanded cards and retains saved custom sizes", () => {
  const { services, close } = createTestContext();
  try {
    const workspace = createWorkspace(services);
    const elements = ["First", "Second"].map(
      (name) =>
        services.elements.create(workspace.id, {
          kind: "container",
          name: `${name} platform component with a long title that must wrap across multiple lines`,
          description: "A separate line of details.\n".repeat(15),
        }).result,
    );
    const source = elements[0];
    const target = elements[1];
    if (!source || !target) throw new Error("Missing elements");
    services.relationships.create(workspace.id, {
      sourceElementId: source.id,
      targetElementId: target.id,
    });
    const view = services.views.create(workspace.id, {
      name: "Expanded view",
      kind: "container",
      elementIds: elements.map((element) => element.id),
      settings: { showFullTitles: true, showDescriptions: true },
    }).result;
    services.views.saveLayout(workspace.id, view.id, [
      { elementId: source.id, width: 260, height: 110 },
    ]);
    services.views.autoLayout(workspace.id, view.id, "TB");
    const detail = services.views.get(view.id);
    const graph = buildGraph({ view: detail, elements, relationships: [], records: [] });
    const first = graph.nodes.find((node) => node.id === source.id);
    const second = graph.nodes.find((node) => node.id === target.id);
    if (!first || !second || first.type !== "element") throw new Error("Missing nodes");
    expect(first.data.minimumHeight).toBeGreaterThan(300);
    expect(second.position.y).toBeGreaterThan(first.position.y + first.data.minimumHeight);
    expect(detail.elements.find((entry) => entry.elementId === source.id)).toMatchObject({
      width: 260,
      height: 110,
    });
    services.views.update(workspace.id, view.id, {
      settings: { showFullTitles: false, showDescriptions: false },
    });
    expect(
      buildGraph({
        view: services.views.get(view.id),
        elements,
        relationships: [],
        records: [],
      }).nodes.find((node) => node.id === source.id),
    ).toMatchObject({ width: 260, height: 110 });
  } finally {
    close();
  }
});
