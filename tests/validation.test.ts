import { describe, expect, test } from "bun:test";
import { resolveRelationshipsForView, toMermaid, validateDocument } from "@structsmith/domain";
import { createTestContext, createWorkspace } from "./helpers";

describe("validator", () => {
  test("flags a container without a software system and a database without technology", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);
    services.elements.create(workspace.id, {
      kind: "container",
      role: "database",
      name: "Orphan DB",
    });

    const result = services.model.validate(workspace.id);
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toContain("CONTAINER_WITHOUT_SYSTEM");
    expect(codes).toContain("DATABASE_WITHOUT_TECHNOLOGY");
    expect(result.valid).toBe(true);

    close();
  });

  test("a person cannot contain other elements", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);
    const person = services.elements.create(workspace.id, {
      kind: "person",
      name: "Customer",
    }).result;

    // Relaxed mode records a warning instead of refusing the change.
    services.elements.create(workspace.id, {
      kind: "container",
      parentId: person.id,
      name: "Impossible",
    });

    const document = services.model.getDocument(workspace.id);
    const codes = validateDocument(document).issues.map((issue) => issue.code);
    expect(codes).toContain("PARENT_CANNOT_HAVE_CHILDREN");

    close();
  });

  test("strict workspaces refuse invalid nesting", () => {
    const { services, close } = createTestContext();
    const workspace = services.workspaces.create({ name: "Strict", mode: "strict" });
    const person = services.elements.create(workspace.id, {
      kind: "person",
      name: "Customer",
    }).result;

    expect(() =>
      services.elements.create(workspace.id, {
        kind: "container",
        parentId: person.id,
        name: "Impossible",
      }),
    ).toThrow();

    close();
  });
});

describe("implied relationships", () => {
  test("relationships between hidden children are lifted to visible ancestors", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);

    const person = services.elements.create(workspace.id, {
      kind: "person",
      name: "Customer",
    }).result;
    const system = services.elements.create(workspace.id, {
      kind: "softwareSystem",
      name: "Portal",
    }).result;
    const web = services.elements.create(workspace.id, {
      kind: "container",
      parentId: system.id,
      name: "Web App",
    }).result;
    services.relationships.create(workspace.id, {
      sourceElementId: person.id,
      targetElementId: web.id,
      description: "Uses",
      interactionStyle: "sync",
    });

    const document = services.model.getDocument(workspace.id);
    const edges = resolveRelationshipsForView(
      document.elements,
      document.relationships,
      new Set([person.id, system.id]),
    );

    expect(edges).toHaveLength(1);
    expect(edges[0]?.sourceElementId).toBe(person.id);
    expect(edges[0]?.targetElementId).toBe(system.id);
    expect(edges[0]?.implied).toBe(true);

    close();
  });
});

describe("export", () => {
  test("mermaid is generated from the model, not from the diagram", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);
    const system = services.elements.create(workspace.id, {
      kind: "softwareSystem",
      name: "Portal",
    }).result;
    const api = services.elements.create(workspace.id, {
      kind: "container",
      parentId: system.id,
      name: "Backend API",
      technology: "Bun",
    }).result;
    services.relationships.create(workspace.id, {
      sourceElementId: system.id,
      targetElementId: api.id,
      description: "Contains",
      interactionStyle: "sync",
    });

    const mermaid = toMermaid(services.model.getDocument(workspace.id));
    expect(mermaid).toStartWith("flowchart LR");
    expect(mermaid).toContain("Backend API");
    expect(mermaid).toContain("subgraph");

    close();
  });
});
