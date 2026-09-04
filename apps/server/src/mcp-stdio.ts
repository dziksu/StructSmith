/**
 * Optional stdio entry point for MCP clients that cannot speak Streamable HTTP
 * (spec §20). It shares the exact same domain services as the HTTP server.
 */
import { createMcpServer } from "@structsmith/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAppContext } from "./bootstrap";
import { loadConfig } from "./config";

const config = loadConfig();
const ctx = createAppContext({ ...config, seedExample: false });
const server = createMcpServer({ services: ctx.services, readOnly: config.mcpReadOnly });

await server.connect(new StdioServerTransport());
