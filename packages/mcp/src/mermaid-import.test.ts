import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestContext } from "../../../tests/helpers";
import { createMcpServer } from "./server";

const source = 'flowchart LR\nClient[Client] -->|"Uses [HTTPS]"| API[API]';

test("MCP import uses the shared contract and domain service", async () => {
  const { services, close } = createTestContext();
  const server = createMcpServer({ services, readOnly: false });
  const client = new Client({ name: "mermaid-import-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tool = (await client.listTools()).tools.find((entry) => entry.name === "import_mermaid");
    expect(tool?.annotations?.destructiveHint).toBe(true);
    const result = await client.callTool({
      name: "import_mermaid",
      arguments: { source, name: "MCP import" },
    });
    expect(result.isError).not.toBe(true);
    const workspace = services.workspaces.list()[0];
    if (!workspace) throw new Error("No imported workspace");
    expect(workspace.name).toBe("MCP import");
    expect(services.model.getDocument(workspace.id).relationships[0]).toMatchObject({
      description: "Uses",
      technology: "HTTPS",
    });
    for (const args of [
      { source: " " },
      { source, mode: "overwrite" },
      { source, name: "x".repeat(201) },
    ]) {
      const invalid = await client.callTool({ name: "import_mermaid", arguments: args });
      expect(invalid.isError).toBe(true);
    }
    expect(services.workspaces.list()).toHaveLength(1);
  } finally {
    await client.close();
    await server.close();
    close();
  }
});

test("read-only MCP does not expose Mermaid import", async () => {
  const { services, close } = createTestContext();
  const server = createMcpServer({ services, readOnly: true });
  const client = new Client({ name: "mermaid-readonly-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    expect((await client.listTools()).tools.some((entry) => entry.name === "import_mermaid")).toBe(
      false,
    );
  } finally {
    await client.close();
    await server.close();
    close();
  }
});
