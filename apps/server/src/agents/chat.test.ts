import { expect, test } from "bun:test";
import { once } from "node:events";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentSettingsSchema, defaultAgentSettings } from "@structsmith/contracts";
import express from "express";
import { createTestContext, createWorkspace } from "../../../../tests/helpers";
import { createApp } from "../app";
import { createAppContext } from "../bootstrap";
import { loadConfig } from "../config";
import { errorMiddleware } from "../http-errors";
import { agentChatRoutes, localAgentAccess } from "../routes/agent-chat";
import { readCodexModels } from "./codex-models";
import { agentInvocation, parseAgentLine } from "./providers";
import { AgentChatService } from "./service";

test("a real child CLI uses the temporary scoped HTTP MCP bridge in token mode", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-chat-bridge-"));
  const ctx = createAppContext({
    ...loadConfig({
      DATABASE_PATH: ":memory:",
      AGENT_CHAT_DIR: directory,
      SEED_EXAMPLE: "false",
      AUTH_MODE: "token",
      APP_TOKEN: "test-app-token",
    }),
    databasePath: ":memory:",
  });
  const { app, agents, mcp } = createApp(ctx);
  if (!agents) throw new Error("Chat disabled");
  const project = createWorkspace(ctx.services);
  const capture = join(directory, "mcp-url.txt");
  const fake = join(directory, "fake-mcp-agent");
  writeFileSync(
    fake,
    `#!${process.execPath}\nimport {Client} from ${JSON.stringify(import.meta.resolve("@modelcontextprotocol/sdk/client/index.js"))};\nimport {StreamableHTTPClientTransport} from ${JSON.stringify(import.meta.resolve("@modelcontextprotocol/sdk/client/streamableHttp.js"))};\nconst input=await Bun.stdin.text();\nconst config=process.argv.find(arg=>arg.startsWith('mcp_servers.structsmith.url='));\nconst url=JSON.parse(config.slice(config.indexOf('=')+1));\nawait Bun.write(${JSON.stringify(capture)},url);\nconst client=new Client({name:'test-cli',version:'1'});\nawait client.connect(new StreamableHTTPClientTransport(new URL(url)));\nconst id=${JSON.stringify(project.id)};\nconst inspection=await client.callTool({name:'workspace_inspect',arguments:{workspaceId:id}});\nconst revision=JSON.parse(inspection.content[0].text).revision;\nconst result=await client.callTool({name:'model_apply_operations',arguments:{workspaceId:id,expectedRevision:revision,operations:[{op:'createElement',data:{kind:'person',name:'Via CLI MCP'}}]}});\nif(result.isError) throw new Error(JSON.stringify(result));\nawait client.close();\nconsole.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Architecture updated'}}));\n`,
  );
  chmodSync(fake, 0o700);
  const settings = structuredClone(defaultAgentSettings);
  settings.providers.codex.executable = fake;
  agents.setSettings(settings);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No server address");
    const base = `http://127.0.0.1:${address.port}`;
    const chat = agents.create({ workspaceId: project.id });
    agents.update(chat.id, { mode: "edit" });
    const response = await fetch(`${base}/api/agent-chat/chats/${chat.id}/messages`, {
      method: "POST",
      headers: { Authorization: "Bearer test-app-token", "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Add an architect" }),
    });
    expect(response.status).toBe(202);
    expect((await completed(agents, chat.id)).messages.at(-1)).toMatchObject({
      text: "Architecture updated",
      status: "complete",
    });
    expect(ctx.services.model.get(project.id).elements[0]?.name).toBe("Via CLI MCP");
    const revoked = await fetch(readFileSync(capture, "utf8"));
    expect(revoked.status).toBe(404);
    expect((await fetch(`${base}/api/agent-chat/chats`)).status).toBe(401);
  } finally {
    await agents.close();
    await mcp.closeAll();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    ctx.database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

async function completed(service: AgentChatService, id: string) {
  for (let i = 0; i < 200; i++) {
    const chat = service.get(id);
    if (chat.messages.at(-1)?.status !== "running") return chat;
    await Bun.sleep(10);
  }
  throw new Error("Test CLI did not finish.");
}

test("local CLI conversations persist, retain project/context on provider changes, and support Stop", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-chat-"));
  const { services, close } = createTestContext();
  const project = createWorkspace(services);
  const service = new AgentChatService(services, directory, false);
  const fake = join(directory, "fake-agent");
  const capture = join(directory, "prompt.txt");
  const capturedArgs = join(directory, "args.txt");
  writeFileSync(
    fake,
    `#!/bin/sh\nprintf '%s\\n' "$@" > '${capturedArgs}'\ncat > '${capture}'\nprintf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"Odpowiedź testowa"}}'\n`,
  );
  chmodSync(fake, 0o700);
  const settings = structuredClone(defaultAgentSettings);
  settings.providers.codex.executable = fake;
  settings.providers.codex.model = "gpt-6.1-sol";
  settings.providers.codex.reasoningEffort = "high";
  service.setSettings(settings);
  try {
    const chat = service.create({ workspaceId: project.id });
    const context = { type: "workspace" as const, targetId: project.id, label: project.name };
    service.send(
      chat.id,
      { text: "Pytanie z $(echo not-a-shell-command)", context },
      "http://127.0.0.1:3000",
    );
    expect(() => service.send(chat.id, { text: "Concurrent turn" }, "http://localhost")).toThrow(
      "still running",
    );
    expect(() => service.update(chat.id, { provider: "claude" })).toThrow("still running");
    expect(() => service.update(chat.id, { archived: true })).toThrow("still running");
    expect(() => service.update(chat.id, { title: "Rename during run" })).toThrow("still running");
    expect((await completed(service, chat.id)).messages.at(-1)).toMatchObject({
      text: "Odpowiedź testowa",
      status: "complete",
    });
    expect(readFileSync(capture, "utf8")).toContain(project.id);
    expect(readFileSync(capture, "utf8")).toContain("not-a-shell-command");
    expect(readFileSync(capturedArgs, "utf8")).toContain("--model\ngpt-6.1-sol\n");
    expect(readFileSync(capturedArgs, "utf8")).toContain('-c\nmodel_reasoning_effort="high"\n');
    service.update(chat.id, { provider: "claude" });
    expect(service.get(chat.id).workspaceId).toBe(project.id);
    service.update(chat.id, { provider: "codex" });
    service.send(chat.id, { text: "Continue" }, "http://127.0.0.1:3000");
    await completed(service, chat.id);
    expect(readFileSync(capture, "utf8")).toContain("Odpowiedź testowa");
    const messages = structuredClone(service.get(chat.id).messages);
    service.update(chat.id, { title: "Invoice architecture review", archived: true });
    expect(service.list().find((topic) => topic.id === chat.id)).toMatchObject({
      title: "Invoice architecture review",
      archived: true,
      workspaceId: project.id,
    });
    expect(() => service.send(chat.id, { text: "Archived turn" }, "http://localhost")).toThrow(
      "Restore",
    );
    expect(service.get(chat.id).messages).toEqual(messages);
    const restored = new AgentChatService(services, directory, false);
    expect(restored.get(chat.id).messages).toHaveLength(4);
    expect(restored.get(chat.id)).toMatchObject({
      title: "Invoice architecture review",
      archived: true,
      workspaceId: project.id,
    });
    expect(restored.getSettings()).toEqual(settings);
    service.update(chat.id, { archived: false });
    expect(service.get(chat.id).messages).toEqual(messages);
    expect(new AgentChatService(services, directory, false).get(chat.id).archived).toBe(false);
    writeFileSync(fake, "#!/bin/sh\ncat >/dev/null\nsleep 30\n");
    service.send(chat.id, { text: "Stop me" }, "http://localhost:3000");
    service.stop(chat.id);
    expect((await completed(service, chat.id)).messages.at(-1)?.status).toBe("cancelled");
    const general = service.create({});
    expect(() => service.update(general.id, { mode: "edit" })).toThrow("Choose a project");
    expect(() => service.update(chat.id, { directory: "relative-path" })).toThrow(
      "absolute directory",
    );
    settings.providers.codex.executable = "/missing/cli";
    service.setSettings(settings);
    const before = service.get(chat.id).messages.length;
    expect(() => service.send(chat.id, { text: "Missing" }, "http://localhost")).toThrow(
      "CLI not found",
    );
    expect(service.get(chat.id).messages).toHaveLength(before);
  } finally {
    await service.close();
    close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("topic order persists, preserves hidden slots, and stays stable when topics change", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-chat-order-"));
  const { services, close } = createTestContext();
  const project = createWorkspace(services);
  try {
    const service = new AgentChatService(services, directory, false);
    const first = service.create({ workspaceId: project.id });
    const hidden = service.create({});
    const second = service.create({ workspaceId: project.id });
    const archived = service.create({});
    service.update(archived.id, { archived: true });
    expect(service.list().map((topic) => topic.id)).toEqual([
      archived.id,
      second.id,
      hidden.id,
      first.id,
    ]);
    const ordered = [archived.id, first.id, hidden.id, second.id];
    expect(service.reorder({ topicIds: [first.id, second.id] }).map((topic) => topic.id)).toEqual(
      ordered,
    );
    service.update(second.id, { title: "Renamed without moving", provider: "claude" });
    service.update(first.id, { archived: true });
    expect(service.list().map((topic) => topic.id)).toEqual(ordered);
    const restored = new AgentChatService(services, directory, false);
    expect(restored.list().map((topic) => topic.id)).toEqual(ordered);
    expect(restored.get(second.id)).toMatchObject({
      title: "Renamed without moving",
      provider: "claude",
      workspaceId: project.id,
      messages: [],
    });
    const stored = readFileSync(join(directory, "chats.json"), "utf8");
    expect(() => restored.reorder({ topicIds: [first.id, first.id] })).toThrow("distinct");
    expect(() => restored.reorder({ topicIds: [] })).toThrow("distinct");
    expect(() => restored.reorder({ topicIds: [second.id, "missing"] })).toThrow("not found");
    expect(readFileSync(join(directory, "chats.json"), "utf8")).toBe(stored);
    const newest = restored.create({});
    restored.delete(hidden.id);
    expect(
      new AgentChatService(services, directory, false).list().map((topic) => topic.id),
    ).toEqual([newest.id, archived.id, first.id, second.id]);
  } finally {
    close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy topics keep their recency order when manual ordering is introduced", () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-chat-legacy-order-"));
  const { services, close } = createTestContext();
  try {
    const service = new AgentChatService(services, directory, false);
    const first = service.create({});
    const second = service.create({});
    const file = join(directory, "chats.json");
    const legacy = JSON.parse(readFileSync(file, "utf8"));
    delete legacy.topicOrder;
    legacy.chats[0].updatedAt = "2026-10-05T10:00:00.000Z";
    legacy.chats[1].updatedAt = "2026-10-04T10:00:00.000Z";
    writeFileSync(file, JSON.stringify(legacy));
    const restored = new AgentChatService(services, directory, false);
    expect(restored.list().map((topic) => topic.id)).toEqual([first.id, second.id]);
    restored.reorder({ topicIds: [second.id, first.id] });
    expect(
      new AgentChatService(services, directory, false).list().map((topic) => topic.id),
    ).toEqual([second.id, first.id]);
  } finally {
    close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("restart marks interrupted responses failed rather than leaving chat stuck", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-chat-restart-"));
  const { services, close } = createTestContext();
  try {
    const service = new AgentChatService(services, directory, false);
    const chat = service.create({});
    const data = JSON.parse(readFileSync(join(directory, "chats.json"), "utf8"));
    delete data.chats[0].archived;
    data.chats[0].messages = [
      {
        id: "m",
        role: "assistant",
        text: "Partial",
        provider: "codex",
        status: "running",
        createdAt: chat.createdAt,
      },
    ];
    writeFileSync(join(directory, "chats.json"), JSON.stringify(data));
    const restored = new AgentChatService(services, directory, false);
    expect(restored.get(chat.id).messages[0]).toMatchObject({ status: "failed", text: "Partial" });
    expect(restored.get(chat.id).archived).toBe(false);
  } finally {
    close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI arguments and provider events preserve text and errors without invoking a shell", () => {
  const chat = { provider: "codex" as const } as Parameters<typeof agentInvocation>[0];
  const prompt = "quote ' and $(echo injected)";
  const invocation = agentInvocation(
    chat,
    defaultAgentSettings,
    prompt,
    "http://localhost/mcp/key",
  );
  expect(invocation.stdin).toBe(prompt);
  expect(invocation.args).toContain("read-only");
  expect(invocation.args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
  expect(invocation.args.some((arg) => arg.startsWith("model_reasoning_effort="))).toBe(false);
  const settings = structuredClone(defaultAgentSettings);
  settings.providers.codex.reasoningEffort = "ultra";
  expect(agentInvocation(chat, settings, prompt, "http://localhost/mcp").args).toContain(
    'model_reasoning_effort="ultra"',
  );
  for (const provider of ["claude", "copilot"] as const) {
    expect(
      agentInvocation({ ...chat, provider }, settings, prompt, "http://localhost/mcp").args.some(
        (arg) => arg.startsWith("model_reasoning_effort="),
      ),
    ).toBe(false);
  }
  expect(
    parseAgentLine("codex", '{"type":"turn.failed","error":{"message":"Login required"}}'),
  ).toEqual({ error: "Login required" });
  expect(
    parseAgentLine(
      "claude",
      '{"type":"assistant","message":{"content":[{"type":"text","text":"First"}]}}',
    ).text,
  ).toContain("First");
  expect(parseAgentLine("claude", '{"type":"result","result":"Final","is_error":false}')).toEqual({
    text: "Final",
    replace: true,
  });
  expect(
    parseAgentLine("claude", '{"type":"result","is_error":true,"errors":["Rate limit"]}').error,
  ).toBe("Rate limit");
  expect(parseAgentLine("copilot", "Plain reply").text).toBe("Plain reply\n");
});

test("legacy settings keep CLI defaults and invalid reasoning levels are rejected", () => {
  const legacy = JSON.parse(JSON.stringify(defaultAgentSettings));
  delete legacy.providers.codex.reasoningEffort;
  expect(AgentSettingsSchema.parse(legacy).providers.codex.reasoningEffort).toBe("default");
  legacy.providers.codex.reasoningEffort = "arbitrary-value";
  expect(AgentSettingsSchema.safeParse(legacy).success).toBe(false);
});

test("Codex catalog exposes only model IDs and supported reasoning levels with safe fallback", () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-codex-models-"));
  const file = join(directory, "models_cache.json");
  try {
    expect(readCodexModels(file)).toEqual([]);
    writeFileSync(
      file,
      JSON.stringify({
        models: [
          {
            slug: "gpt-6.1-sol",
            supported_reasoning_levels: [{ effort: "low" }, { effort: "ultra" }],
            extra: "not exposed",
          },
          {
            slug: "gpt-6-luna",
            supported_reasoning_levels: [{ effort: "low" }, { effort: "max" }],
          },
          { slug: "future", supported_reasoning_levels: [{ effort: "unknown-level" }] },
          { bad: "entry" },
        ],
      }),
    );
    expect(readCodexModels(file)).toEqual([
      { id: "gpt-6.1-sol", reasoningEfforts: ["low", "ultra"] },
      { id: "gpt-6-luna", reasoningEfforts: ["low", "max"] },
    ]);
    writeFileSync(file, "invalid JSON");
    expect(readCodexModels(file)).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("REST chat rejects foreign origins and disabled execution and persists through validated DTOs", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-chat-http-"));
  const { services, close } = createTestContext();
  const service = new AgentChatService(services, directory, false);
  const config = loadConfig({ AGENT_CHAT_DIR: directory });
  const app = express();
  app.use(express.json());
  app.use("/api/agent-chat", localAgentAccess(true), agentChatRoutes(service, config));
  app.use("/disabled", localAgentAccess(false), agentChatRoutes(service, config));
  app.use(errorMiddleware);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No server address");
    const endpoint = `http://127.0.0.1:${address.port}`;
    const settings = structuredClone(defaultAgentSettings);
    settings.providers.codex.reasoningEffort = "max";
    const saved = await fetch(`${endpoint}/api/agent-chat/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ providers: { codex: { reasoningEffort: "max" } } });
    const invalidEffort = await fetch(`${endpoint}/api/agent-chat/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        providers: {
          ...settings.providers,
          codex: { ...settings.providers.codex, reasoningEffort: "not-an-effort" },
        },
      }),
    });
    expect(invalidEffort.status).toBe(400);
    expect(service.getSettings().providers.codex.reasoningEffort).toBe("max");
    expect(
      (
        await fetch(`${endpoint}/api/agent-chat/settings`, {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
    ).toBe(403);
    expect((await fetch(`${endpoint}/disabled/settings`)).status).toBe(403);
    const response = await fetch(`${endpoint}/api/agent-chat/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ workspaceId: null, provider: "claude" }),
    });
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created).toMatchObject({
      workspaceId: null,
      provider: "claude",
      mode: "ask",
      archived: false,
    });
    const topicUrl = `${endpoint}/api/agent-chat/chats/${created.id}`;
    const renamed = await fetch(topicUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  Architecture questions  ", archived: true }),
    });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({ title: "Architecture questions", archived: true });
    const invalidRename = await fetch(topicUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   ", archived: false }),
    });
    expect(invalidRename.status).toBe(400);
    expect(service.get(created.id)).toMatchObject({
      title: "Architecture questions",
      archived: true,
    });
    const restoredTopic = await fetch(topicUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    expect(restoredTopic.status).toBe(200);
    expect(await restoredTopic.json()).toMatchObject({
      title: "Architecture questions",
      archived: false,
    });
    const another = service.create({});
    const orderedIds = [created.id, another.id];
    const reordered = await fetch(`${endpoint}/api/agent-chat/chats/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicIds: orderedIds }),
    });
    expect(reordered.status).toBe(200);
    expect((await reordered.json()).map((topic: { id: string }) => topic.id)).toEqual(orderedIds);
    for (const topicIds of [[created.id, created.id], ["missing"], []]) {
      const invalidOrder = await fetch(`${endpoint}/api/agent-chat/chats/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIds }),
      });
      expect([400, 404]).toContain(invalidOrder.status);
      expect(service.list().map((topic) => topic.id)).toEqual(orderedIds);
    }
    const invalid = await fetch(`${endpoint}/api/agent-chat/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "arbitrary-program" }),
    });
    expect(invalid.status).toBe(400);
    expect(service.list()).toHaveLength(2);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await service.close();
    close();
    rmSync(directory, { recursive: true, force: true });
  }
});
