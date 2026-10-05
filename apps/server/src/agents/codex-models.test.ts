import { expect, test } from "bun:test";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultAgentSettings } from "@structsmith/contracts";
import express from "express";
import { createTestContext } from "../../../../tests/helpers";
import { loadConfig } from "../config";
import { errorMiddleware } from "../http-errors";
import { agentChatRoutes, localAgentAccess } from "../routes/agent-chat";
import { listCodexModels } from "./codex-models";
import { AgentOutputParser, agentErrorMessage } from "./providers";
import { AgentChatService } from "./service";
import { fakeCodex } from "./test-cli";

const model = (id: string, efforts: string[], hidden = false) => ({
  id: `picker-${id}`,
  model: id,
  displayName: id.toUpperCase(),
  hidden,
  isDefault: id === "listed-model",
  supportedReasoningEfforts: efforts.map((reasoningEffort) => ({ reasoningEffort })),
  privateMetadata: "not exposed",
});

test("model picker uses the configured executable, paginates and never starts inference", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-model-picker-"));
  const cli = join(directory, "CLI with spaces");
  const capture = join(directory, "methods.jsonl");
  const ctx = createTestContext();
  const service = new AgentChatService(ctx.services, directory, false);
  const first = [
    model("listed-model", ["low", "high", "future-level"]),
    model("hidden-model", ["medium"], true),
    { bad: "entry" },
  ];
  const second = [model("other-model", []), model("listed-model", ["low", "high"])];
  fakeCodex(
    cli,
    "throw new Error('Inference must not run')",
    "",
    `
await Bun.write(${JSON.stringify(capture)}, (await Bun.file(${JSON.stringify(capture)}).exists() ? await Bun.file(${JSON.stringify(capture)}).text() : '') + JSON.stringify({method:request.method,params,appToken:process.env.APP_TOKEN}) + '\\n');
console.log(JSON.stringify({id:request.id,result:params.cursor ? {data:${JSON.stringify(second)},nextCursor:null} : {data:${JSON.stringify(first)},nextCursor:'next'}}));
`,
  );
  const app = express();
  app.use("/api/agent-chat", localAgentAccess(true), agentChatRoutes(service, loadConfig({})));
  app.use("/disabled", localAgentAccess(false), agentChatRoutes(service, loadConfig({})));
  app.use(errorMiddleware);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing address");
    const url = `http://127.0.0.1:${address.port}/api/agent-chat/codex/models?executable=${encodeURIComponent(cli)}`;
    expect((await fetch(url, { headers: { Origin: "https://foreign.example" } })).status).toBe(403);
    expect((await fetch(url.replace("/api/agent-chat", "/disabled"))).status).toBe(403);
    expect((await fetch(url.split("?")[0] ?? "")).status).toBe(400);
    const result = await fetch(url);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual([
      {
        id: "listed-model",
        displayName: "LISTED-MODEL",
        isDefault: true,
        reasoningEfforts: ["low", "high"],
      },
      { id: "other-model", displayName: "OTHER-MODEL", isDefault: false, reasoningEfforts: [] },
    ]);
    const calls = readFileSync(capture, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(calls).toEqual([
      { method: "model/list", params: { limit: 100, includeHidden: false } },
      { method: "model/list", params: { cursor: "next", limit: 100, includeHidden: false } },
    ]);
    expect(service.getSettings()).toEqual(defaultAgentSettings);
    expect(service.list()).toEqual([]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    ctx.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("catalog failures are bounded and missing CLIs have readable errors", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-model-failure-"));
  const cli = join(directory, "fake-cli");
  try {
    expect(() => listCodexModels(join(directory, "missing"))).toThrow("CLI not found");
    fakeCodex(cli, "", "", "");
    await expect(listCodexModels(cli, 100)).rejects.toThrow("timed out");
    fakeCodex(cli, "", "", "console.log(JSON.stringify({id:request.id,result:{data:'invalid'}}));");
    await expect(listCodexModels(cli)).rejects.toThrow("invalid model list");
    fakeCodex(
      cli,
      "",
      "",
      "console.log(JSON.stringify({id:request.id,result:{data:[],nextCursor:'same'}}));",
    );
    await expect(listCodexModels(cli)).rejects.toThrow("invalid model list cursor");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("nested Codex error envelopes show the message from the screenshot", () => {
  const message =
    "The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.";
  const envelope = JSON.stringify({
    type: "error",
    status: 400,
    error: { type: "invalid_request_error", message },
  });
  expect(agentErrorMessage(envelope)).toBe(message);
  expect(agentErrorMessage({ message: JSON.stringify({ error: JSON.parse(envelope) }) })).toBe(
    message,
  );
  expect(agentErrorMessage("Login required")).toBe("Login required");
  expect(agentErrorMessage("{malformed")).toBe("{malformed");
  expect(agentErrorMessage('{"detail":"Unexpected provider failure"}')).toBe(
    '{"detail":"Unexpected provider failure"}',
  );
  expect(agentErrorMessage({ error: "invalid_request", message: "Login required" })).toBe(
    "Login required",
  );
  const parser = new AgentOutputParser("codex");
  expect(
    parser.parse({ method: "error", params: { willRetry: false, error: { message: envelope } } }),
  ).toEqual({ error: message });
});
