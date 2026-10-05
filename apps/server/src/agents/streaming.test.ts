import { expect, test } from "bun:test";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AgentChatStreamEvent, defaultAgentSettings } from "@structsmith/contracts";
import { createTestContext } from "../../../../tests/helpers";
import { readChatEvents } from "../../../web/src/features/chat/stream";
import { createApp } from "../app";
import { createAppContext } from "../bootstrap";
import { loadConfig } from "../config";
import { CodexSession } from "./codex-session";
import { AgentOutputParser } from "./providers";
import { AgentChatService } from "./service";
import { fakeCodex } from "./test-cli";

async function until(predicate: () => boolean) {
  for (let i = 0; i < 300; i++) {
    if (predicate()) return;
    await Bun.sleep(10);
  }
  throw new Error("Streaming test timed out.");
}

test("authenticated SSE shows partial text/reasoning, reconnects, completes once and retains Stop output", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-stream-"));
  const ctx = createAppContext({
    ...loadConfig({
      DATABASE_PATH: ":memory:",
      AGENT_CHAT_DIR: directory,
      SEED_EXAMPLE: "false",
      AUTH_MODE: "token",
      APP_TOKEN: "test-token",
    }),
    databasePath: ":memory:",
  });
  const { app, agents, mcp } = createApp(ctx);
  if (!agents) throw new Error("Chat disabled");
  const fake = join(directory, "fake-agent");
  const prompt = join(directory, "prompt.txt");
  fakeCodex(
    fake,
    `
await Bun.write(${JSON.stringify(prompt)},params.input[0].text);
emit('item/reasoning/summaryTextDelta',{itemId:'r',summaryIndex:0,delta:'Readable summary'});
emit('item/agentMessage/delta',{itemId:'a',delta:'Zażółć'});
await Bun.sleep(700);
emit('item/agentMessage/delta',{itemId:'a',delta:' gęślą.'});
await Bun.sleep(700);
emit('item/completed',{item:{id:'r',type:'reasoning',summary:['Readable summary'],content:['opaque content must not appear']}});
emit('item/completed',{item:{id:'a',type:'agentMessage',text:'Zażółć gęślą.'}});
`,
  );
  const settings = structuredClone(defaultAgentSettings);
  settings.providers.codex.executable = fake;
  agents.setSettings(settings);
  const chat = await agents.create({});
  const olderText = "x".repeat(50000);
  chat.messages.push({
    id: "older",
    role: "assistant",
    text: olderText,
    provider: "codex",
    status: "complete",
    createdAt: chat.createdAt,
  });
  const server = app.listen(0, "127.0.0.1");
  const controllers: AbortController[] = [];
  const reads: Promise<void>[] = [];
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing address");
    const base = `http://127.0.0.1:${address.port}`;
    const endpoint = `${base}/api/agent-chat/chats/${chat.id}/events`;
    const headers = { Authorization: "Bearer test-token" };
    expect((await fetch(endpoint)).status).toBe(401);
    expect(
      (await fetch(endpoint, { headers: { ...headers, Origin: "https://foreign.example" } }))
        .status,
    ).toBe(403);
    expect((await fetch(`${base}/api/agent-chat/chats/missing/events`, { headers })).status).toBe(
      404,
    );
    const subscribe = async () => {
      const controller = new AbortController();
      controllers.push(controller);
      const response = await fetch(endpoint, { headers, signal: controller.signal });
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      if (!response.body) throw new Error("Missing stream");
      const events: AgentChatStreamEvent[] = [];
      reads.push(readChatEvents(response.body, (event) => events.push(event)).catch(() => {}));
      await until(() => events.length > 0);
      return { controller, events };
    };
    const first = await subscribe();
    expect(first.events[0]).toMatchObject({
      type: "snapshot",
      chat: { id: chat.id, messages: [expect.objectContaining({ text: olderText })] },
    });
    await agents.send(chat.id, { text: "Explain this" }, base);
    await until(() =>
      first.events.some((event) => event.type === "message" && event.message.text === "Zażółć"),
    );
    expect(chat.messages.at(-1)).toMatchObject({
      text: "Zażółć",
      reasoning: "Readable summary",
      status: "running",
    });
    first.controller.abort();
    await until(() => chat.messages.at(-1)?.text === "Zażółć gęślą.");
    expect(chat.messages.at(-1)?.status).toBe("running");
    const second = await subscribe();
    expect(second.events[0]).toMatchObject({
      type: "snapshot",
      chat: {
        messages: [
          expect.objectContaining({ id: "older" }),
          expect.anything(),
          expect.objectContaining({ text: "Zażółć gęślą.", status: "running" }),
        ],
      },
    });
    await until(() =>
      second.events.some(
        (event) => event.type === "message" && event.message.status === "complete",
      ),
    );
    expect(chat.messages.at(-1)).toMatchObject({
      text: "Zażółć gęślą.",
      reasoning: "Readable summary",
      status: "complete",
    });
    expect(new AgentChatService(ctx.services, directory, false).get(chat.id).messages).toEqual(
      chat.messages,
    );
    await agents.send(chat.id, { text: "Stop this turn" }, base);
    await until(() => chat.messages.at(-1)?.text === "Zażółć");
    expect(readFileSync(prompt, "utf8")).not.toContain("Readable summary");
    agents.stop(chat.id);
    await until(() =>
      second.events.some(
        (event) => event.type === "message" && event.message.status === "cancelled",
      ),
    );
    expect(chat.messages.at(-1)).toMatchObject({
      text: "Zażółć",
      reasoning: "Readable summary",
      status: "cancelled",
    });
    expect(
      new AgentChatService(ctx.services, directory, false).get(chat.id).messages.at(-1),
    ).toMatchObject({ text: "Zażółć", reasoning: "Readable summary", status: "cancelled" });
  } finally {
    controllers.forEach((controller) => {
      controller.abort();
    });
    await Promise.all(reads);
    await agents.close();
    await mcp.closeAll();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    ctx.database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Claude reconciles individual complete blocks sharing an ID and ignores tool JSON and subagents", () => {
  const parser = new AgentOutputParser("claude");
  const stream = (event: Record<string, unknown>) => parser.parse({ type: "stream_event", event });
  stream({ type: "message_start", message: { id: "m" } });
  stream({
    type: "content_block_start",
    index: 0,
    content_block: { type: "thinking", thinking: "" },
  });
  expect(
    stream({
      type: "content_block_delta",
      index: 0,
      delta: { type: "thinking_delta", thinking: "Summary" },
    }),
  ).toMatchObject({ reasoning: "Summary" });
  parser.parse({
    type: "assistant",
    message: { id: "m", content: [{ type: "thinking", thinking: "Summary" }] },
  });
  stream({ type: "content_block_start", index: 1, content_block: { type: "text", text: "" } });
  expect(
    stream({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "First" } }),
  ).toMatchObject({ text: "First" });
  expect(
    parser.parse({
      type: "assistant",
      message: { id: "m", content: [{ type: "text", text: "First" }] },
    }),
  ).toMatchObject({ text: "First" });
  stream({ type: "content_block_start", index: 2, content_block: { type: "text", text: "" } });
  stream({ type: "content_block_delta", index: 2, delta: { type: "text_delta", text: "Second" } });
  expect(
    parser.parse({
      type: "assistant",
      message: { id: "m", content: [{ type: "text", text: "Second" }] },
    }).text,
  ).toBe("First\n\nSecond");
  expect(
    stream({
      type: "content_block_delta",
      index: 3,
      delta: { type: "input_json_delta", partial_json: "secret tool input" },
    }),
  ).toEqual({});
  expect(
    parser.parse({
      type: "assistant",
      parent_tool_use_id: "subagent",
      message: { content: [{ type: "text", text: "Other agent" }] },
    }),
  ).toEqual({});
  expect(parser.parse({ type: "result", is_error: false, result: "Final answer" })).toEqual({
    text: "Final answer",
  });
});

test("failed Codex turns keep partial content and expose the CLI error", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-stream-failed-"));
  const { services, close } = createTestContext();
  const service = new AgentChatService(services, directory, false);
  const fake = join(directory, "fake-agent");
  fakeCodex(
    fake,
    `emit('item/agentMessage/delta',{itemId:'a',delta:'Partial reply'});
emit('turn/completed',{turn:{status:'failed',error:{message:'Quota exceeded'}}});`,
  );
  const settings = structuredClone(defaultAgentSettings);
  settings.providers.codex.executable = fake;
  service.setSettings(settings);
  try {
    const chat = await service.create({});
    await service.send(chat.id, { text: "Explain" }, "http://localhost");
    await until(() => chat.messages.at(-1)?.status !== "running");
    expect(chat.messages.at(-1)).toMatchObject({
      text: "Partial reply",
      status: "failed",
      error: "Quota exceeded",
    });
  } finally {
    await service.close();
    close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Codex and Copilot reconcile deltas, summaries and final blocks without exposing opaque reasoning", () => {
  const codex = new AgentOutputParser("codex");
  const event = (method: string, params: Record<string, unknown>) =>
    codex.parse({ method, params });
  event("item/agentMessage/delta", { itemId: "a", delta: "First" });
  expect(
    event("item/completed", { item: { id: "a", type: "agentMessage", text: "First" } }).text,
  ).toBe("First");
  expect(event("item/agentMessage/delta", { itemId: "b", delta: "Second" }).text).toBe(
    "First\n\nSecond",
  );
  event("item/reasoning/summaryTextDelta", { itemId: "r", summaryIndex: 0, delta: "Summary" });
  expect(
    event("item/completed", {
      item: { id: "r", type: "reasoning", summary: ["Summary", "Next"], content: ["opaque"] },
    }).reasoning,
  ).toBe("Summary\n\nNext");
  expect(event("item/reasoning/textDelta", { itemId: "r", delta: "opaque" })).toEqual({});
  expect(event("error", { willRetry: true, error: { message: "Transient" } })).toEqual({});
  const copilot = new AgentOutputParser("copilot");
  copilot.parse({
    type: "assistant.message_delta",
    data: { messageId: "m", deltaContent: "Reply" },
  });
  copilot.parse({
    type: "assistant.reasoning_delta",
    data: { reasoningId: "r", deltaContent: "Summary" },
  });
  expect(
    copilot.parse({ type: "assistant.reasoning", data: { reasoningId: "r", content: "Summary" } })
      .reasoning,
  ).toBe("Summary");
  expect(
    copilot.parse({
      type: "assistant.message",
      data: {
        messageId: "m",
        content: "Reply",
        reasoningText: "Summary",
        reasoningOpaque: "opaque",
      },
    }),
  ).toMatchObject({ text: "Reply" });
  expect(
    copilot.parse({
      type: "assistant.message_delta",
      agentId: "subagent",
      data: { deltaContent: "Other" },
    }),
  ).toEqual({});
  expect(copilot.parse({ type: "session.error", data: { message: "Quota exceeded" } }).error).toBe(
    "Quota exceeded",
  );
});

test("Codex protocol failures are terminal and unsupported interactive requests receive a response", () => {
  const writes: unknown[] = [];
  const errors: (string | undefined)[] = [];
  const session = new CodexSession(
    (value) => writes.push(value),
    (error) => errors.push(error),
    defaultAgentSettings.providers.codex,
    "/tmp",
    "prompt",
    "http://localhost/mcp",
  );
  session.receive({ id: 1, error: { message: "Login required" } });
  expect(errors[0]).toBe("Login required");
  session.receive({ id: "approval", method: "item/commandExecution/requestApproval" });
  expect(writes.at(-1)).toMatchObject({ id: "approval", error: { code: -32601 } });
  expect(errors.at(-1)).toContain("interactive input");
});
