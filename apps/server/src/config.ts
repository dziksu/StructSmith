import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT } from "@structsmith/contracts";

const here = dirname(fileURLToPath(import.meta.url));
/** apps/server/src -> repository root (or /app inside the container). */
export const rootDir = resolve(here, "../../..");

const resolvePath = (value: string): string =>
  isAbsolute(value) ? value : resolve(rootDir, value);

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

export interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  migrationsDir: string;
  webDistDir: string | null;
  authMode: "none" | "token";
  appToken: string | null;
  mcpReadOnly: boolean;
  seedExample: boolean;
  version: string;
  productName: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const authMode = env.AUTH_MODE === "token" ? "token" : "none";
  const webDist = resolvePath(env.WEB_DIST_DIR ?? join("apps", "web", "dist"));

  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? "0.0.0.0",
    databasePath: resolvePath(env.DATABASE_PATH ?? join("data", "architecture.db")),
    migrationsDir: resolvePath(env.MIGRATIONS_DIR ?? "migrations"),
    webDistDir: existsSync(join(webDist, "index.html")) ? webDist : null,
    authMode,
    appToken: env.APP_TOKEN?.trim() ? env.APP_TOKEN.trim() : null,
    mcpReadOnly: bool(env.MCP_READ_ONLY, false),
    seedExample: bool(env.SEED_EXAMPLE, true),
    version: env.APP_VERSION ?? PRODUCT.version,
    productName: env.APP_NAME ?? PRODUCT.name,
  };
}
