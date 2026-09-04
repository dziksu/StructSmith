import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

export type Db = BunSQLiteDatabase<typeof schema>;

export interface DatabaseHandle {
  db: Db;
  sqlite: Database;
  close(): void;
}

/**
 * SQLite is the only database in the MVP (spec §15). Foreign keys and WAL are
 * mandatory: the model relies on cascading deletes.
 */
export function createDatabase(path: string): DatabaseHandle {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const sqlite = new Database(path, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");

  const db = drizzle(sqlite, { schema });
  return { db, sqlite, close: () => sqlite.close() };
}
