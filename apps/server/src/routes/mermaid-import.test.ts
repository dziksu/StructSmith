import { expect, test } from "bun:test";
import { once } from "node:events";
import { WorkspaceSchema } from "@structsmith/contracts";
import express from "express";
import { createTestContext } from "../../../../tests/helpers";
import { errorMiddleware } from "../http-errors";
import { workspaceRoutes } from "./workspaces";

const source = 'flowchart LR\nClient[Client] -->|"Uses [HTTPS]"| API[API]';

test("REST imports Mermaid and rejects invalid input before any write", async () => {
  const { services, close } = createTestContext();
  const app = express();
  app.use(express.json());
  app.use("/api", workspaceRoutes(services));
  app.use(errorMiddleware);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing server address");
    const endpoint = `http://127.0.0.1:${address.port}/api/workspaces/import/mermaid`;
    const post = (body: unknown) =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const response = await post({ source, name: "REST import" });
    expect(response.status).toBe(201);
    const workspace = WorkspaceSchema.parse(await response.json());
    expect(workspace.name).toBe("REST import");
    const document = services.model.getDocument(workspace.id);
    expect(document.elements).toHaveLength(2);
    expect(document.relationships[0]).toMatchObject({ description: "Uses", technology: "HTTPS" });
    for (const body of [
      { source: "sequenceDiagram\nA->>B: Hello" },
      { source: " " },
      { source, mode: "overwrite" },
    ]) {
      const invalid = await post(body);
      expect(invalid.status).toBe(400);
      await invalid.text();
    }
    expect(services.workspaces.list()).toHaveLength(1);
    expect(services.model.getDocument(workspace.id)).toEqual(document);
    const overwritten = await post({
      source: "graph TB; Replacement",
      mode: "overwrite",
      workspaceId: workspace.id,
    });
    expect(overwritten.status).toBe(201);
    expect(WorkspaceSchema.parse(await overwritten.json()).revision).toBe(2);
    expect(services.model.getDocument(workspace.id).elements[0]?.name).toBe("Replacement");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    close();
  }
});
