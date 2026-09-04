import { createDatabase, runMigrations } from "@structsmith/database";
import { loadConfig } from "../apps/server/src/config";

const config = loadConfig();
const database = createDatabase(config.databasePath);
const result = runMigrations(database.sqlite, config.migrationsDir);

console.log(`[db] database: ${config.databasePath}`);
console.log(`[db] applied: ${result.applied.length ? result.applied.join(", ") : "none"}`);
console.log(`[db] already applied: ${result.skipped.length}`);
database.close();
