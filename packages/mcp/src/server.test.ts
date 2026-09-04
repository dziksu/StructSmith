import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestContext } from "../../../tests/helpers";
import { createMcpServer } from "./server";

test("MCP exposes and validates Zod 4 tools and prompt arguments", async () => {
  const { services, close } = createTestContext();
  const server = createMcpServer({ services, readOnly: false });
  const client = new Client({ name: "migration-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    expect(tools.find((tool) => tool.name === "workspace_create")?.inputSchema).toMatchObject({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    });
    const created = await client.callTool({ name: "workspace_create", arguments: { name: "MCP" } });
    expect(created.isError).not.toBe(true);
    const invalid = await client.callTool({ name: "workspace_create", arguments: { name: 42 } });
    expect(invalid.isError).toBe(true);
    const workspaces = services.workspaces.list();
    expect(workspaces).toHaveLength(1);
    const workspace = workspaces[0];
    if (!workspace) throw new Error("Missing workspace");
    const prompt = await client.getPrompt({
      name: "review_architecture",
      arguments: { workspaceId: workspace.id },
    });
    expect(prompt.messages[0]?.content).toMatchObject({
      type: "text",
      text: expect.stringContaining(workspace.id),
    });
  } finally {
    await client.close();
    await server.close();
    close();
  }
});
