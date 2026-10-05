import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestContext, createWorkspace } from "../../../tests/helpers";
import { createChatMcpServer } from "./chat";

test("chat MCP scopes reads and writes, requires a revision, and preserves domain snapshots", async () => {
  const { services, bus, close } = createTestContext();
  const project = createWorkspace(services, "Chat project");
  const other = createWorkspace(services, "Other project");
  const server = createChatMcpServer(services, project.id, false);
  const client = new Client({ name: "chat-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const events: string[] = [];
  const unsubscribe = bus.subscribe((event) => events.push(event.type));
  try {
    await server.connect(b);
    await client.connect(a);
    const batch = {
      workspaceId: project.id,
      expectedRevision: project.revision,
      operations: [{ op: "createElement", data: { kind: "person", name: "Architect" } }],
    };
    expect(
      (await client.callTool({ name: "workspace_inspect", arguments: { workspaceId: other.id } }))
        .isError,
    ).toBe(true);
    expect(
      (
        await client.callTool({
          name: "model_apply_operations",
          arguments: { ...batch, workspaceId: other.id },
        })
      ).isError,
    ).toBe(true);
    expect(
      (await client.callTool({ name: "model_preview_operations", arguments: batch })).isError,
    ).not.toBe(true);
    expect(services.model.get(project.id).elements).toHaveLength(0);
    expect(
      (
        await client.callTool({
          name: "model_apply_operations",
          arguments: { workspaceId: project.id, operations: batch.operations },
        })
      ).isError,
    ).toBe(true);
    expect(
      (await client.callTool({ name: "model_apply_operations", arguments: batch })).isError,
    ).not.toBe(true);
    expect(services.model.get(project.id).elements[0]?.name).toBe("Architect");
    expect(services.snapshots.list(project.id)).toHaveLength(1);
    expect(events).toContain("workspace.changed");
    expect(
      (await client.callTool({ name: "model_apply_operations", arguments: batch })).isError,
    ).toBe(true);
    expect(services.model.get(other.id).elements).toHaveLength(0);
  } finally {
    unsubscribe();
    await client.close();
    await server.close();
    close();
  }
});

test("ask mode and general chats expose no architecture write tool", async () => {
  const { services, close } = createTestContext();
  const project = createWorkspace(services);
  try {
    for (const scope of [project.id, null]) {
      const server = createChatMcpServer(services, scope, true);
      const client = new Client({ name: "ask-test", version: "1" });
      const [a, b] = InMemoryTransport.createLinkedPair();
      try {
        await server.connect(b);
        await client.connect(a);
        expect((await client.listTools()).tools.map((tool) => tool.name)).not.toContain(
          "model_apply_operations",
        );
      } finally {
        await client.close();
        await server.close();
      }
    }
  } finally {
    close();
  }
});
