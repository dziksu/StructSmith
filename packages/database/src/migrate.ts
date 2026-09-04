import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Minimal forward-only migrator: every `*.sql` file in `migrations/` is applied
 * once, in filename order, inside a transaction.
 */
export function runMigrations(sqlite: Database, migrationsDir: string): MigrationResult {
  if (!existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     );`,
  );

  const done = new Set(
    sqlite
      .query<{ name: string }, []>("SELECT name FROM schema_migrations")
      .all()
      .map((row) => row.name),
  );

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (done.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const insert = sqlite.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
    const apply = sqlite.transaction(() => {
      sqlite.exec(sql);
      insert.run(file, new Date().toISOString());
    });
    apply();
    applied.push(file);
  }

  return { applied, skipped };
}
