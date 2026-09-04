import {
  createDatabase,
  type DatabaseHandle,
  DrizzleStore,
  runMigrations,
} from "@structsmith/database";
import { createServices, InMemoryEventBus, type Services } from "@structsmith/domain";
import type { AppConfig } from "./config";
import { seedExampleWorkspace } from "./seed";

export interface AppContext {
  config: AppConfig;
  database: DatabaseHandle;
  services: Services;
  bus: InMemoryEventBus;
}

export function createAppContext(config: AppConfig): AppContext {
  const database = createDatabase(config.databasePath);
  const migration = runMigrations(database.sqlite, config.migrationsDir);
  if (migration.applied.length > 0) {
    console.log(
      `[db] applied ${migration.applied.length} migration(s): ${migration.applied.join(", ")}`,
    );
  }

  const bus = new InMemoryEventBus();
  const store = new DrizzleStore(database.db);
  const services = createServices(store, bus);

  if (config.seedExample) {
    try {
      seedExampleWorkspace(services);
    } catch (error) {
      console.warn("[seed] could not seed the example workspace:", error);
    }
  }

  return { config, database, services, bus };
}
