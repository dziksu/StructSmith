import { createApp } from "./app";
import { createAppContext } from "./bootstrap";
import { loadConfig } from "./config";

const config = loadConfig();
const ctx = createAppContext(config);
const { app, mcp } = createApp(ctx);

const server = app.listen(config.port, config.host, () => {
  const base = `http://localhost:${config.port}`;
  console.log(`\n  ${config.productName} v${config.version}`);
  console.log(
    `  UI        ${ctx.config.webDistDir ? base : "http://localhost:5173 (vite dev server)"}`,
  );
  console.log(`  REST API  ${base}/api`);
  console.log(
    `  MCP       ${base}/mcp  (streamable http${config.mcpReadOnly ? ", read-only" : ""})`,
  );
  console.log(`  Health    ${base}/health`);
  console.log(`  Database  ${config.databasePath}\n`);
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`\n[server] ${signal} received, shutting down.`);
  await mcp.closeAll().catch(() => undefined);
  server.close(() => {
    ctx.database.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
