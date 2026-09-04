import { describe, expect, test } from "bun:test";
import { DomainError } from "@structsmith/domain";
import { createTestContext, createWorkspace } from "./helpers";

describe("semantic model", () => {
  test("elements, relationships and views live in one model", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);

    const system = services.elements.create(workspace.id, {
      kind: "softwareSystem",
      name: "Client Portal",
    }).result;
    const api = services.elements.create(workspace.id, {
      kind: "container",
      role: "apiGateway",
      parentId: system.id,
      name: "Backend API",
    }).result;
    const database = services.elements.create(workspace.id, {
      kind: "container",
      role: "database",
      parentId: system.id,
      name: "PostgreSQL",
      technology: "PostgreSQL 16",
    }).result;

    services.relationships.create(workspace.id, {
      sourceElementId: api.id,
      targetElementId: database.id,
      description: "Reads from",
      interactionStyle: "data",
    });

    const model = services.model.get(workspace.id);
    expect(model.elements).toHaveLength(3);
    expect(model.relationships).toHaveLength(1);

    close();
  });

  test("one element appears in many views without being copied", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);
    const element = services.elements.create(workspace.id, {
      kind: "softwareSystem",
      name: "ERP",
    }).result;

    const first = services.views.create(workspace.id, {
      name: "Context",
      kind: "systemContext",
      elementIds: [element.id],
    }).result;
    const second = services.views.create(workspace.id, {
      name: "Landscape",
      kind: "landscape",
      elementIds: [element.id],
    }).result;

    services.views.saveLayout(workspace.id, first.id, [{ elementId: element.id, x: 10, y: 20 }]);
    services.views.saveLayout(workspace.id, second.id, [{ elementId: element.id, x: 500, y: 900 }]);

    expect(services.model.get(workspace.id).elements).toHaveLength(1);
    expect(services.views.get(first.id).elements[0]).toMatchObject({ x: 10, y: 20 });
    expect(services.views.get(second.id).elements[0]).toMatchObject({ x: 500, y: 900 });

    close();
  });

  test("changing the layout does not change the model", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);
    const element = services.elements.create(workspace.id, {
      kind: "softwareSystem",
      name: "ERP",
    }).result;
    const view = services.views.create(workspace.id, {
      name: "Context",
      kind: "systemContext",
      elementIds: [element.id],
    }).result;

    const before = services.model.get(workspace.id);
    services.views.saveLayout(workspace.id, view.id, [{ elementId: element.id, x: 42, y: 42 }]);
    const after = services.model.get(workspace.id);

    expect(after.elements).toEqual(before.elements);
    expect(after.relationships).toEqual(before.relationships);

    close();
  });

  test("deleting an element removes its relationships and view placements", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);
    const system = services.elements.create(workspace.id, {
      kind: "softwareSystem",
      name: "Portal",
    }).result;
    const container = services.elements.create(workspace.id, {
      kind: "container",
      parentId: system.id,
      name: "API",
    }).result;
    const other = services.elements.create(workspace.id, {
      kind: "softwareSystem",
      name: "ERP",
    }).result;
    services.relationships.create(workspace.id, {
      sourceElementId: container.id,
      targetElementId: other.id,
      interactionStyle: "sync",
    });
    const view = services.views.create(workspace.id, {
      name: "Containers",
      kind: "container",
      elementIds: [container.id, other.id],
    }).result;

    services.elements.delete(workspace.id, system.id);

    expect(services.model.get(workspace.id).elements.map((element) => element.id)).toEqual([other.id]);
    expect(services.model.get(workspace.id).relationships).toHaveLength(0);
    expect(services.views.get(view.id).elements.map((entry) => entry.elementId)).toEqual([other.id]);

    close();
  });
});

describe("revision guard", () => {
  test("a stale expectedRevision is rejected with a conflict", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);

    services.elements.create(workspace.id, { kind: "person", name: "Customer" });

    expect(() =>
      services.elements.create(
        workspace.id,
        { kind: "person", name: "Other" },
        { expectedRevision: workspace.revision },
      ),
    ).toThrow(DomainError);

    try {
      services.elements.create(
        workspace.id,
        { kind: "person", name: "Other" },
        { expectedRevision: workspace.revision },
      );
    } catch (error) {
      expect((error as DomainError).status).toBe(409);
    }

    close();
  });

  test("every mutation bumps the revision", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);
    const first = services.elements.create(workspace.id, { kind: "person", name: "A" }).revision;
    const second = services.elements.create(workspace.id, { kind: "person", name: "B" }).revision;

    expect(second).toBe(first + 1);
    close();
  });
});
