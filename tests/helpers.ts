import { createDatabase, DrizzleStore, runMigrations } from "@structsmith/database";
import { createServices, InMemoryEventBus, type Services } from "@structsmith/domain";
import { fileURLToPath } from "node:url";

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

export interface TestContext {
  services: Services;
  bus: InMemoryEventBus;
  close: () => void;
}

/** Every test gets its own in-memory database with the real migrations applied. */
export function createTestContext(): TestContext {
  const database = createDatabase(":memory:");
  runMigrations(database.sqlite, migrationsDir);

  const bus = new InMemoryEventBus();
  const services = createServices(new DrizzleStore(database.db), bus);

  return { services, bus, close: () => database.close() };
}

export function createWorkspace(services: Services, name = "Test") {
  return services.workspaces.create({ name, mode: "relaxed" });
}
