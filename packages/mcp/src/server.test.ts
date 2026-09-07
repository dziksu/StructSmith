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
    expect(client.getInstructions()).toContain("workspace_inspect");
    expect(client.getInstructions()).toContain("never inspect StructSmith source code");
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "modeling_guide",
        "workspace_inspect",
        "reference_resolve",
        "model_preview_operations",
      ]),
    );
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

    const guide = await client.callTool({ name: "modeling_guide", arguments: {} });
    expect(guide.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("relationship once at the most specific"),
        }),
      ]),
    );

    const inspection = await client.callTool({
      name: "workspace_inspect",
      arguments: { workspaceId: workspace.id },
    });
    expect(inspection.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining('"validation"'),
        }),
      ]),
    );

    const preview = await client.callTool({
      name: "model_preview_operations",
      arguments: {
        workspaceId: workspace.id,
        operations: [{ op: "createElement", data: { kind: "person", name: "Preview" } }],
      },
    });
    expect(preview.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining('"persisted": false'),
        }),
      ]),
    );
    expect(services.model.get(workspace.id).elements).toHaveLength(0);

    const element = services.elements.create(workspace.id, {
      kind: "person",
      name: "Referenced user",
    }).result;
    const resolved = await client.callTool({
      name: "reference_resolve",
      arguments: { workspaceId: workspace.id, type: "element", targetId: element.id },
    });
    expect(resolved.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining('"name": "Referenced user"'),
        }),
      ]),
    );

    const guideResource = await client.readResource({ uri: "architecture://guide" });
    const guideContent = guideResource.contents[0];
    expect(guideContent && "text" in guideContent ? guideContent.text : "").toContain(
      '"operationKinds"',
    );

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
