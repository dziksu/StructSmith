import type { Repositories, Store } from "@structsmith/domain";
import type { Db } from "./client";
import { createRepositories } from "./repositories";

/**
 * Drizzle-backed unit of work. Nested `transaction()` calls reuse the current
 * transaction so services can compose freely.
 */
export class DrizzleStore implements Store {
  private readonly root: Repositories;
  private current: Repositories | null = null;

  constructor(private readonly db: Db) {
    this.root = createRepositories(db);
  }

  private get repos(): Repositories {
    return this.current ?? this.root;
  }

  get workspaces() {
    return this.repos.workspaces;
  }
  get elements() {
    return this.repos.elements;
  }
  get relationships() {
    return this.repos.relationships;
  }
  get views() {
    return this.repos.views;
  }
  get records() {
    return this.repos.records;
  }
  get snapshots() {
    return this.repos.snapshots;
  }
  get activity() {
    return this.repos.activity;
  }

  transaction<T>(fn: (repos: Repositories) => T): T {
    if (this.current) return fn(this.current);

    return this.db.transaction((tx) => {
      const repos = createRepositories(tx);
      this.current = repos;
      try {
        return fn(repos);
      } finally {
        this.current = null;
      }
    });
  }
}
