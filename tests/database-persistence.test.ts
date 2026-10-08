import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase, DrizzleStore, runMigrations } from "@structsmith/database";
import { createServices, InMemoryEventBus } from "@structsmith/domain";

test("SQLite data survives reopening and migrations are not reapplied", () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-persistence-"));
  const databasePath = join(directory, "test.db");
  const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));
  const name = "Client's portal — zażółć";
  try {
    const first = createDatabase(databasePath);
    let workspaceId: string;
    let viewId: string;
    let applied: string[];
    try {
      applied = runMigrations(first.sqlite, migrationsDir).applied;
      expect(applied.length).toBeGreaterThan(0);
      const services = createServices(new DrizzleStore(first.db), new InMemoryEventBus());
      workspaceId = services.workspaces.create({ name }).id;
      const source = services.elements.create(workspaceId, {
        name: "API",
        kind: "softwareSystem",
      }).result;
      const target = services.elements.create(workspaceId, {
        name: "Worker",
        kind: "softwareSystem",
      }).result;
      const relationship = services.relationships.create(workspaceId, {
        sourceElementId: source.id,
        targetElementId: target.id,
      }).result;
      viewId = services.views.create(workspaceId, {
        name: "Runtime",
        kind: "custom",
        elementIds: [source.id, target.id],
      }).result.id;
      services.views.saveLayout(
        workspaceId,
        viewId,
        [],
        [
          {
            relationshipId: relationship.id,
            color: "#22c55e",
            sourceSide: "bottom",
            targetSide: "top",
            labelPosition: 0.78,
            labelOffset: { x: 25, y: -30 },
            endArrow: "open",
            legendLabel: "Success",
          },
        ],
      );
    } finally {
      first.close();
    }

    const reopened = createDatabase(databasePath);
    try {
      const migration = runMigrations(reopened.sqlite, migrationsDir);
      expect(migration.applied).toEqual([]);
      expect(migration.skipped).toEqual(applied);
      const services = createServices(new DrizzleStore(reopened.db), new InMemoryEventBus());
      expect(services.workspaces.get(workspaceId).name).toBe(name);
      expect(services.model.get(workspaceId).elements).toHaveLength(2);
      expect(services.views.get(viewId).relationships[0]).toMatchObject({
        color: "#22c55e",
        sourceSide: "bottom",
        targetSide: "top",
        labelPosition: 0.78,
        labelOffset: { x: 25, y: -30 },
        endArrow: "open",
        legendLabel: "Success",
      });
      services.workspaces.update(workspaceId, { name: "Updated" });
      expect(services.workspaces.get(workspaceId).name).toBe("Updated");
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
