import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestContext } from "../../../tests/helpers";
import { MCP_TOOLS } from "./catalog";
import { createMcpServer } from "./server";

function parseToolJson(result: unknown): unknown {
  if (!result || typeof result !== "object" || !("content" in result)) {
    throw new Error("MCP tool did not return content.");
  }
  const blocks = ((result as { content?: unknown }).content ?? []) as Array<{
    type?: string;
    text?: string;
  }>;
  const text = blocks.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("MCP tool did not return JSON text content.");
  return JSON.parse(text) as unknown;
}

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
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      MCP_TOOLS.map((tool) => tool.name).sort(),
    );
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "modeling_guide",
        "workspace_inspect",
        "reference_resolve",
        "model_preview_operations",
        "boundary_list",
        "boundary_create",
        "boundary_update",
        "boundary_delete",
        "view_set_layout",
        "view_auto_layout",
      ]),
    );
    expect(
      JSON.stringify(tools.find((tool) => tool.name === "boundary_create")?.inputSchema),
    ).toContain("View that owns this boundary");
    expect(
      JSON.stringify(tools.find((tool) => tool.name === "view_update")?.inputSchema),
    ).toContain("Wrap full element titles");
    expect(
      JSON.stringify(tools.find((tool) => tool.name === "view_set_layout")?.inputSchema),
    ).toContain("controlPoints");
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
    const guideJson = parseToolJson(guide) as {
      enums: { layoutAlgorithms: string[]; relationshipRoutings: string[] };
      views: { boundaryBehavior: string; settings: { showDescriptions: string } };
    };
    expect(guideJson.enums.layoutAlgorithms).toEqual(["dagre", "force", "radial", "grid"]);
    expect(guideJson.enums.relationshipRoutings).toEqual(["orthogonal", "curved", "straight"]);
    expect(guideJson.views.boundaryBehavior).toContain("not a boundary object");
    expect(guideJson.views.settings.showDescriptions).toContain("descriptions");

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

    const system = services.elements.create(workspace.id, {
      kind: "softwareSystem",
      name: "Platform",
    }).result;
    const relationship = services.relationships.create(workspace.id, {
      sourceElementId: element.id,
      targetElementId: system.id,
      description: "Uses",
    }).result;
    const createdView = await client.callTool({
      name: "view_create",
      arguments: {
        workspaceId: workspace.id,
        data: {
          name: "Security context",
          kind: "systemContext",
          elementIds: [element.id, system.id],
          settings: {
            boundaryLayer: "security",
            autoLayoutAlgorithm: "radial",
            showFullTitles: true,
            showDescriptions: true,
          },
        },
      },
    });
    expect(createdView.isError).not.toBe(true);
    const viewId = (parseToolJson(createdView) as { result: { id: string } }).result.id;

    const createdBoundary = await client.callTool({
      name: "boundary_create",
      arguments: {
        workspaceId: workspace.id,
        data: {
          viewId,
          kind: "trustZone",
          layer: "security",
          classification: "private",
          name: "Private zone",
          elementIds: [system.id],
        },
      },
    });
    expect(createdBoundary.isError).not.toBe(true);

    const savedLayout = await client.callTool({
      name: "view_set_layout",
      arguments: {
        workspaceId: workspace.id,
        viewId,
        entries: [{ elementId: element.id, x: 120, y: 80, locked: true }],
        relationships: [
          {
            relationshipId: relationship.id,
            labelPosition: 0.35,
            controlPoints: [{ x: 240, y: 140 }],
          },
        ],
      },
    });
    expect(savedLayout.isError).not.toBe(true);

    const autoLayout = await client.callTool({
      name: "view_auto_layout",
      arguments: {
        workspaceId: workspace.id,
        viewId,
        algorithm: "radial",
        rootElementId: system.id,
      },
    });
    expect(autoLayout.isError).not.toBe(true);

    const compactInspection = parseToolJson(
      await client.callTool({
        name: "workspace_inspect",
        arguments: { workspaceId: workspace.id },
      }),
    ) as {
      layoutsIncluded: boolean;
      views: Array<{
        id: string;
        boundaries: Array<{ name: string; elementIds: string[] }>;
        elements: Array<{ elementId: string; hidden: boolean; x?: number }>;
      }>;
    };
    const compactView = compactInspection.views.find((view) => view.id === viewId);
    expect(compactInspection.layoutsIncluded).toBe(false);
    expect(compactView?.elements).toContainEqual({ elementId: system.id, hidden: false });
    expect(compactView?.elements[0]).not.toHaveProperty("x");
    expect(compactView?.boundaries[0]).toMatchObject({
      name: "Private zone",
      elementIds: [system.id],
    });

    const fullInspection = parseToolJson(
      await client.callTool({
        name: "workspace_inspect",
        arguments: { workspaceId: workspace.id, includeLayouts: true },
      }),
    ) as {
      layoutsIncluded: boolean;
      views: Array<{
        id: string;
        elements: Array<{ elementId: string; x: number; locked: boolean }>;
        relationships: Array<{
          relationshipId: string;
          labelPosition: number | null;
          controlPoints: Array<{ x: number; y: number }>;
        }>;
      }>;
    };
    const fullView = fullInspection.views.find((view) => view.id === viewId);
    expect(fullInspection.layoutsIncluded).toBe(true);
    expect(fullView?.elements.find((entry) => entry.elementId === element.id)).toMatchObject({
      x: 120,
      y: 80,
      locked: true,
    });
    expect(fullView?.relationships).toContainEqual(
      expect.objectContaining({
        relationshipId: relationship.id,
        labelPosition: 0.35,
        controlPoints: [{ x: 240, y: 140 }],
      }),
    );

    const resolvedMember = parseToolJson(
      await client.callTool({
        name: "reference_resolve",
        arguments: { workspaceId: workspace.id, type: "element", targetId: system.id },
      }),
    ) as { context: { views: Array<{ boundaryMemberships: Array<{ name: string }> }> } };
    expect(resolvedMember.context.views[0]?.boundaryMemberships).toContainEqual(
      expect.objectContaining({ name: "Private zone" }),
    );

    const resolvedRelationship = parseToolJson(
      await client.callTool({
        name: "reference_resolve",
        arguments: {
          workspaceId: workspace.id,
          type: "relationship",
          targetId: relationship.id,
        },
      }),
    ) as { context: { views: Array<{ representedAs: { implied: boolean } }> } };
    expect(resolvedRelationship.context.views[0]?.representedAs.implied).toBe(false);

    const viewResource = await client.readResource({
      uri: `architecture://workspace/${workspace.id}/view/${viewId}`,
    });
    const viewResourceContent = viewResource.contents[0];
    expect(
      viewResourceContent && "text" in viewResourceContent ? viewResourceContent.text : "",
    ).toContain('"name": "Private zone"');

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
