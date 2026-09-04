import { describe, expect, test } from "bun:test";
import type { ArchitectureOperation } from "@structsmith/contracts";
import { createTestContext, createWorkspace } from "./helpers";

describe("batch operations", () => {
  test("a whole logical change is applied atomically with forward references", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);

    const operations: ArchitectureOperation[] = [
      { op: "createElement", ref: "api", data: { kind: "container", name: "Backend API" } },
      {
        op: "createElement",
        ref: "queue",
        data: { kind: "container", role: "queue", name: "Invoice Queue", technology: "SQS" },
      },
      {
        op: "createElement",
        ref: "worker",
        data: { kind: "container", role: "worker", name: "Invoice Worker" },
      },
      {
        op: "createRelationship",
        data: {
          sourceElementId: "@api",
          targetElementId: "@queue",
          description: "Publishes to",
          interactionStyle: "async",
        },
      },
      {
        op: "createRelationship",
        data: {
          sourceElementId: "@queue",
          targetElementId: "@worker",
          description: "Delivers to",
          interactionStyle: "async",
        },
      },
      {
        op: "createView",
        ref: "view",
        data: { name: "Invoices", kind: "custom", elementIds: ["@api", "@queue", "@worker"] },
      },
      { op: "autoLayoutView", viewId: "@view", direction: "LR" },
    ];

    const result = services.model.applyOperations(workspace.id, { operations }, "mcp");

    expect(result.success).toBe(true);
    expect(result.revision).toBe(result.previousRevision + 1);
    expect(result.appliedOperations).toHaveLength(7);
    expect(result.snapshotId).toBeTruthy();

    const model = services.model.get(workspace.id);
    expect(model.elements).toHaveLength(3);
    expect(model.relationships).toHaveLength(2);

    close();
  });

  test("a failing operation rolls the whole batch back", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);

    expect(() =>
      services.model.applyOperations(
        workspace.id,
        {
          operations: [
            { op: "createElement", ref: "a", data: { kind: "container", name: "Kept?" } },
            { op: "deleteElement", elementId: "does-not-exist", cascade: true },
          ],
        },
        "mcp",
      ),
    ).toThrow();

    expect(services.model.get(workspace.id).elements).toHaveLength(0);
    close();
  });

  test("an unknown reference is rejected", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);

    expect(() =>
      services.model.applyOperations(
        workspace.id,
        {
          operations: [
            {
              op: "createRelationship",
              data: {
                sourceElementId: "@missing",
                targetElementId: "@other",
                interactionStyle: "sync",
              },
            },
          ],
        },
        "mcp",
      ),
    ).toThrow(/Unknown reference/);

    close();
  });
});

describe("snapshots", () => {
  test("an MCP batch can be undone by restoring its snapshot", () => {
    const { services, close } = createTestContext();
    const workspace = createWorkspace(services);
    services.elements.create(workspace.id, { kind: "person", name: "Customer" });

    const result = services.model.applyOperations(
      workspace.id,
      {
        label: "AI change",
        operations: [{ op: "createElement", data: { kind: "container", name: "Queue" } }],
      },
      "mcp",
    );
    expect(services.model.get(workspace.id).elements).toHaveLength(2);

    services.snapshots.restore(result.snapshotId as string);

    const model = services.model.get(workspace.id);
    expect(model.elements).toHaveLength(1);
    expect(model.elements[0]?.name).toBe("Customer");

    close();
  });
});

describe("events", () => {
  test("a change emits a workspace event carrying the new revision", () => {
    const { services, bus, close } = createTestContext();
    const workspace = createWorkspace(services);

    const seen: { revision: number; source: string }[] = [];
    bus.subscribe((event) => {
      if (event.type === "workspace.changed") {
        seen.push({ revision: event.revision, source: event.source });
      }
    });

    services.model.applyOperations(
      workspace.id,
      { operations: [{ op: "createElement", data: { kind: "person", name: "Customer" } }] },
      "mcp",
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]?.source).toBe("mcp");
    close();
  });
});
