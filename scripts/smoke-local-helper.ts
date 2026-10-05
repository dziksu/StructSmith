import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  AgentChatSchema,
  defaultAgentSettings,
  PRODUCT,
  WorkspaceSchema,
} from "@structsmith/contracts";
import { fakeCodex } from "../apps/server/src/agents/test-cli";

// A disposable real-Docker test. The executable starts from a directory with no checkout.
const image = process.argv[2];
if (!image) throw new Error("Usage: bun scripts/smoke-local-helper.ts IMAGE");
const executable = resolve(
  `dist/local-helper/structsmith-local-${process.platform}-${process.arch}`,
);
const directory = mkdtempSync(join(tmpdir(), "structsmith-local-smoke-"));
const profile = join(directory, "profile");
const name = `structsmith-local-smoke-${process.pid}`;
const volume = `${name}-data`;
const base = "http://127.0.0.1:59090";
let logs = "";
let helperExitCode: number | null = null;
const helper = Bun.spawn(
  [
    executable,
    "--image",
    image,
    "--port",
    "59090",
    "--backend-port",
    "59091",
    "--container",
    name,
    "--volume",
    volume,
    "--data-dir",
    profile,
    "--no-open",
  ],
  {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
  },
);
const output = Promise.all([
  new Response(helper.stdout).text(),
  new Response(helper.stderr).text(),
]).then((parts) => {
  logs = parts.join("\n");
});
const request = (path: string, method = "GET", body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
async function waitFor(predicate: () => Promise<boolean>, description: string) {
  for (let i = 0; i < 300; i++) {
    if (await predicate().catch(() => false)) return;
    if (helper.exitCode !== null) throw new Error(`Helper exited before ${description}`);
    await Bun.sleep(100);
  }
  throw new Error(`Timed out: ${description}`);
}
try {
  await waitFor(async () => (await request("/api/agent-chat/settings")).ok, "startup");
  assert.equal((await request("/health")).status, 200);
  assert.match(await (await request("/")).text(), /<html/);
  assert.equal(
    (await fetch(`${base}/api/workspaces`, { headers: { Origin: "https://foreign.example" } }))
      .status,
    403,
  );
  assert.equal((await fetch("http://127.0.0.1:59091/api/workspaces")).status, 401);
  const project = WorkspaceSchema.parse(
    await (
      await request("/api/workspaces", "POST", { name: "Native helper smoke", mode: "relaxed" })
    ).json(),
  );
  const fake = join(directory, "fake-codex");
  const capability = join(directory, "capability.txt");
  fakeCodex(
    fake,
    `
const url=Object.values(threadParams.config.mcp_servers).find(value=>value.enabled)?.url;
await Bun.write(${JSON.stringify(capability)},url);
const client=new Client({name:'docker-smoke',version:'1'});
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
const id=${JSON.stringify(project.id)};
const before=await client.callTool({name:'workspace_inspect',arguments:{workspaceId:id}});
emit('item/reasoning/summaryTextDelta',{itemId:'reason',delta:'Inspecting Docker model'});
emit('item/agentMessage/delta',{itemId:'answer',delta:'Working'});
await Bun.sleep(200);
const result=await client.callTool({name:'model_apply_operations',arguments:{workspaceId:id,expectedRevision:JSON.parse(before.content[0].text).revision,operations:[{op:'createElement',data:{kind:'person',name:'Native agent smoke'}}]}});
if(result.isError) throw new Error(JSON.stringify(result));
await client.close();
emit('item/completed',{item:{id:'answer',type:'agentMessage',text:'Done from native CLI'}});`,
    `import {Client} from ${JSON.stringify(Bun.resolveSync("@modelcontextprotocol/sdk/client/index.js", resolve("apps/server")))};
import {StreamableHTTPClientTransport} from ${JSON.stringify(Bun.resolveSync("@modelcontextprotocol/sdk/client/streamableHttp.js", resolve("apps/server")))};`,
  );
  const settings = structuredClone(defaultAgentSettings);
  settings.providers.codex.executable = fake;
  assert.equal((await request("/api/agent-chat/settings", "PUT", settings)).status, 200);
  const chat = AgentChatSchema.parse(
    await (await request("/api/agent-chat/chats", "POST", { workspaceId: project.id })).json(),
  );
  assert.equal(
    (await request(`/api/agent-chat/chats/${chat.id}`, "PATCH", { mode: "edit" })).status,
    200,
  );
  const events = await request(`/api/agent-chat/chats/${chat.id}/events`);
  const reader = events.body?.getReader();
  assert.ok(reader);
  assert.equal(
    (
      await request(`/api/agent-chat/chats/${chat.id}/messages`, "POST", {
        text: "Create an architect",
      })
    ).status,
    202,
  );
  let streamed = "";
  while (!streamed.includes("Inspecting Docker model")) {
    const next: { done: boolean; value?: Uint8Array } = await reader.read();
    assert.equal(next.done, false);
    streamed += new TextDecoder().decode(next.value);
  }
  assert.match(streamed, /"status":"running"/);
  await reader.cancel();
  const readChat = async () =>
    AgentChatSchema.parse(await (await request(`/api/agent-chat/chats/${chat.id}`)).json());
  await waitFor(
    async () => (await readChat()).messages.at(-1)?.status !== "running",
    "agent completion",
  );
  assert.equal((await readChat()).messages.at(-1)?.text, "Done from native CLI");
  const model = await (await request(`/api/workspaces/${project.id}/model`)).json();
  assert.equal(model.elements[0]?.name, "Native agent smoke");
  assert.equal((await fetch(readFileSync(capability, "utf8"))).status, 404);
  fakeCodex(
    fake,
    `emit('item/agentMessage/delta',{itemId:'answer',delta:'Partial before Stop'}); await Bun.sleep(60000);`,
  );
  await request(`/api/agent-chat/chats/${chat.id}/messages`, "POST", { text: "Stop this turn" });
  await waitFor(
    async () => (await readChat()).messages.at(-1)?.text === "Partial before Stop",
    "partial answer",
  );
  await request(`/api/agent-chat/chats/${chat.id}/stop`, "POST");
  await waitFor(async () => (await readChat()).messages.at(-1)?.status === "cancelled", "Stop");
  assert.equal((await readChat()).messages.at(-1)?.text, "Partial before Stop");
  console.log(
    `Standalone helper ${PRODUCT.version}: HTML, authenticated Docker REST, host CLI, scoped MCP writes, streaming and Stop passed.`,
  );
} finally {
  if (helper.exitCode === null) {
    const stop = Bun.spawn([executable, "stop", "--data-dir", profile], {
      cwd: directory,
      stdout: "ignore",
      stderr: "inherit",
    });
    await stop.exited;
    const timer = setTimeout(() => helper.kill("SIGTERM"), 5000);
    helperExitCode = await helper.exited;
    clearTimeout(timer);
  }
  await output;
  if (helperExitCode !== 0) console.error(logs);
  // Only these uniquely named smoke resources are removed; ordinary model volumes survive stop.
  for (const args of [
    ["container", "rm", "--force", name],
    ["volume", "rm", volume],
  ]) {
    const cleanup = Bun.spawn(["docker", ...args], { stdout: "ignore", stderr: "ignore" });
    await cleanup.exited;
  }
  rmSync(directory, { recursive: true, force: true });
  assert.equal(helperExitCode, 0, "Helper must exit cleanly after stop");
}
