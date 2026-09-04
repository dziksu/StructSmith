import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit is only used to generate new migration SQL. Migrations are
 * applied at runtime by `scripts/migrate.ts`.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./packages/database/src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_PATH ?? "./data/architecture.db" },
});
