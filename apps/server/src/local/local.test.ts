import { expect, test } from "bun:test";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentChatSchema, defaultAgentSettings } from "@structsmith/contracts";
import { localChatBackend } from "@structsmith/mcp";
import { createTestContext, createWorkspace } from "../../../../tests/helpers";
import { AgentChatService } from "../agents/service";
import { fakeCodex } from "../agents/test-cli";
import { createApp } from "../app";
import { createAppContext } from "../bootstrap";
import { loadConfig } from "../config";
import { createLocalApp } from "./app";
import { assertLocalUrl } from "./backend";
import { parseLocalOptions } from "./launcher";

async function listen(server: Server) {
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  return new URL(`http://127.0.0.1:${address.port}`);
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function streamUntil(response: Response, needle: string) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No SSE stream");
  let text = "";
  try {
    while (!text.includes(needle)) {
      const next = await reader.read();
      if (next.done) throw new Error(`SSE closed before ${needle}`);
      text += new TextDecoder().decode(next.value);
    }
    return text;
  } finally {
    await reader.cancel();
  }
}

test("host chat proxies Docker REST/SSE and a native CLI edits through scoped MCP", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-local-test-"));
  const token = "private-backend-token-for-tests";
  const ctx = createAppContext({
    ...loadConfig({
      DATABASE_PATH: ":memory:",
      SEED_EXAMPLE: "false",
      AUTH_MODE: "token",
      APP_TOKEN: token,
      AGENT_CHAT_ENABLED: "false",
      AGENT_CHAT_DIR: directory,
    }),
    databasePath: ":memory:",
  });
  const project = createWorkspace(ctx.services, "Docker project");
  const other = createWorkspace(ctx.services, "Another project");
  const docker = createApp(ctx);
  const dockerServer = docker.app.listen(0, "127.0.0.1");
  const backendUrl = await listen(dockerServer);
  const host = await createLocalApp({ backendUrl, token, chatDirectory: directory, port: 0 });
  const hostServer = host.app.listen(0, "127.0.0.1");
  const base = await listen(hostServer);
  const fake = join(directory, "fake-native-codex");
  const capture = join(directory, "capability.txt");
  fakeCodex(
    fake,
    `
const url=Object.values(threadParams.config.mcp_servers).find(value=>value.enabled)?.url;
await Bun.write(${JSON.stringify(capture)},url);
const client=new Client({name:'native-test',version:'1'});
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
const tools=await client.listTools();
if(tools.tools.some(t=>t.name==='workspace_delete')) throw new Error('Broad tool exposed');
const wrong=await client.callTool({name:'workspace_inspect',arguments:{workspaceId:${JSON.stringify(other.id)}}});
if(!wrong.isError) throw new Error('Scope lost');
const id=${JSON.stringify(project.id)};
const before=await client.callTool({name:'workspace_inspect',arguments:{workspaceId:id}});
const revision=JSON.parse(before.content[0].text).revision;
const operations=[{op:'createElement',data:{kind:'person',name:'From native CLI'}}];
const missing=await client.callTool({name:'model_apply_operations',arguments:{workspaceId:id,operations}});
if(!missing.isError) throw new Error('Revision not required');
const preview=await client.callTool({name:'model_preview_operations',arguments:{workspaceId:id,expectedRevision:revision,operations}});
if(preview.isError) throw new Error(JSON.stringify(preview));
emit('item/reasoning/summaryTextDelta',{itemId:'reason',delta:'Inspecting the project'});
emit('item/agentMessage/delta',{itemId:'answer',delta:'Updating architecture'});
await Bun.sleep(150);
const applied=await client.callTool({name:'model_apply_operations',arguments:{workspaceId:id,expectedRevision:revision,operations}});
if(applied.isError) throw new Error(JSON.stringify(applied));
const stale=await client.callTool({name:'model_apply_operations',arguments:{workspaceId:id,expectedRevision:revision,operations}});
if(!stale.isError) throw new Error('Stale revision accepted');
await client.close();
emit('item/completed',{item:{id:'answer',type:'agentMessage',text:'Updating architecture: done'}});
`,
    `import {Client} from ${JSON.stringify(import.meta.resolve("@modelcontextprotocol/sdk/client/index.js"))};
import {StreamableHTTPClientTransport} from ${JSON.stringify(import.meta.resolve("@modelcontextprotocol/sdk/client/streamableHttp.js"))};`,
  );
  const settings = structuredClone(defaultAgentSettings);
  settings.providers.codex.executable = fake;
  const request = (path: string, method = "GET", body?: unknown) =>
    fetch(new URL(path, base), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    expect((await fetch(new URL("/api/workspaces", backendUrl))).status).toBe(401);
    expect((await request("/api/workspaces")).status).toBe(200);
    expect(await (await request("/api/mcp-info")).json()).toMatchObject({
      endpoint: new URL("/mcp", base).href,
      authMode: "none",
    });
    const missingProject = await request("/api/agent-chat/chats", "POST", {
      workspaceId: "missing",
    });
    expect(missingProject.status).toBe(404);
    expect(await missingProject.json()).toMatchObject({ error: { code: "WORKSPACE_NOT_FOUND" } });
    // A body reaches Docker intact; the host never parses the model routes.
    const created = await request("/api/workspaces", "POST", {
      name: "Through proxy",
      mode: "relaxed",
    });
    expect(created.status).toBe(201);
    expect(
      ctx.services.workspaces.list().some((workspace) => workspace.name === "Through proxy"),
    ).toBe(true);
    expect(
      (
        await fetch(new URL("/api/agent-chat/settings", base), {
          headers: { Origin: "https://foreign.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await fetch(new URL("/__structsmith_local/stop", base), { method: "POST" })).status,
    ).toBe(401);
    expect((await request("/api/agent-chat/settings", "PUT", settings)).status).toBe(200);
    const chat = AgentChatSchema.parse(
      await (await request("/api/agent-chat/chats", "POST", { workspaceId: project.id })).json(),
    );
    expect(
      (await request(`/api/agent-chat/chats/${chat.id}`, "PATCH", { mode: "edit" })).status,
    ).toBe(200);
    const controller = new AbortController();
    const chatEvents = await fetch(new URL(`/api/agent-chat/chats/${chat.id}/events`, base), {
      signal: controller.signal,
    });
    const modelEvents = await fetch(new URL(`/api/events?workspaceId=${project.id}`, base), {
      signal: controller.signal,
    });
    const partial = streamUntil(chatEvents, "Inspecting the project");
    const changed = streamUntil(modelEvents, "workspace.updated");
    expect(
      (
        await request(`/api/agent-chat/chats/${chat.id}/messages`, "POST", {
          text: "Add an architect",
        })
      ).status,
    ).toBe(202);
    const partialText = await partial;
    expect(partialText).toContain('"status":"running"');
    expect(await changed).toContain('"source":"mcp"');
    controller.abort();
    for (let i = 0; i < 300 && host.agents.list().some((topic) => topic.running); i++)
      await Bun.sleep(10);
    expect(host.agents.get(chat.id).messages.at(-1)).toMatchObject({
      status: "complete",
      text: "Updating architecture: done",
    });
    expect(ctx.services.model.get(project.id).elements[0]?.name).toBe("From native CLI");
    expect(ctx.services.model.get(other.id).elements).toHaveLength(0);
    expect(ctx.services.snapshots.list(project.id).length).toBeGreaterThan(0);
    expect((await fetch(readFileSync(capture, "utf8"))).status).toBe(404);
    const general = await host.agents.create({});
    expect(() => host.agents.update(general.id, { mode: "edit" })).toThrow("Choose a project");
  } finally {
    await host.close();
    await docker.mcp.closeAll();
    await close(hostServer);
    await close(dockerServer);
    ctx.database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("pending remote reads reserve concurrency and Stop/shutdown cannot launch a late CLI", async () => {
  const ctx = createTestContext();
  const project = createWorkspace(ctx.services);
  const directory = mkdtempSync(join(tmpdir(), "structsmith-start-test-"));
  const backend = localChatBackend(ctx.services);
  const service = new AgentChatService(backend, directory, false);
  try {
    const chats = await Promise.all(
      Array.from({ length: 4 }, () => service.create({ workspaceId: project.id })),
    );
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    backend.getWorkspace = async () => {
      await pending;
      return project;
    };
    const turns = chats
      .slice(0, 3)
      .map((chat) => service.send(chat.id, { text: "Pending" }, "http://localhost"));
    const settled = Promise.allSettled(turns);
    expect(service.list().filter((topic) => topic.running)).toHaveLength(3);
    const first = chats[0];
    const fourth = chats[3];
    if (!first || !fourth) throw new Error("Missing chats");
    await expect(service.send(first.id, { text: "Duplicate" }, "http://localhost")).rejects.toThrow(
      "still running",
    );
    await expect(service.send(fourth.id, { text: "Fourth" }, "http://localhost")).rejects.toThrow(
      "three agents",
    );
    for (const chat of chats.slice(0, 3)) service.stop(chat.id);
    // The first cancellation must be observed before shutdown is used for the others.
    release();
    await expect(turns[0]).rejects.toThrow("cancelled");
    await settled;
    let resume: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => {
      resume = resolve;
    });
    backend.getWorkspace = async () => {
      await blocked;
      return project;
    };
    const late = service.send(fourth.id, { text: "Shutdown" }, "http://localhost");
    await service.close();
    resume();
    await expect(late).rejects.toThrow("cancelled");
    expect(service.get(first.id).messages).toHaveLength(0);
    expect(service.get(fourth.id).messages).toHaveLength(0);
  } finally {
    await service.close();
    ctx.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("local options and backend URLs reject invalid ports, remote origins and Docker flags", () => {
  expect(parseLocalOptions(["--port", "59090", "--no-open"])).toMatchObject({
    port: 59090,
    backendPort: 59091,
    open: false,
  });
  for (const args of [
    ["--port", "65535"],
    ["--port", "1.2"],
    ["--port", "8090", "--backend-port", "8090"],
    ["--container", "--privileged"],
    ["--volume", "/host/path"],
    ["--image", "image --privileged"],
  ])
    expect(() => parseLocalOptions(args)).toThrow();
  for (const url of [
    "https://localhost",
    "http://192.168.1.1",
    "http://localhost/path",
    "http://user:password@localhost",
  ])
    expect(() => assertLocalUrl(new URL(url))).toThrow("localhost origin");
});
