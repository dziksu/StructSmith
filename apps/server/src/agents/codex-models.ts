import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { type CodexModel, CodexReasoningEffortSchema } from "@structsmith/contracts";
import { badRequest } from "@structsmith/domain";
import { z } from "zod";
import { agentErrorMessage, codexAppServerArgs, object } from "./providers";

const ModelSchema = z.object({
  model: z.string().min(1),
  displayName: z.string(),
  hidden: z.boolean().default(false),
  isDefault: z.boolean(),
  supportedReasoningEfforts: z.array(z.object({ reasoningEffort: z.string() })),
});
const PageSchema = z.object({
  data: z.array(z.unknown()),
  nextCursor: z.string().nullable().optional(),
});

/** Ask the configured CLI for its picker catalog; never start a thread or inference. */
export function listCodexModels(executable: string, timeoutMs = 8000): Promise<CodexModel[]> {
  if (!Bun.which(executable)) throw badRequest("Codex CLI not found. Check its executable path.");
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1" };
    delete env.APP_TOKEN;
    const child = spawn(executable, codexAppServerArgs, {
      cwd: tmpdir(),
      env,
      shell: false,
      stdio: ["pipe", "pipe", "ignore"],
    });
    let done = false;
    let buffer = "";
    let bytes = 0;
    let requestId = 2;
    const models = new Map<string, CodexModel>();
    const cursors = new Set<string>();
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.stdin.end();
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 1000);
      killTimer.unref();
      if (error) reject(badRequest(error));
      else resolve([...models.values()]);
    };
    const timer = setTimeout(
      () => finish("Codex model list timed out. Check the CLI in your terminal and try again."),
      timeoutMs,
    );
    const send = (value: unknown) => child.stdin.write(`${JSON.stringify(value)}\n`);
    child.stdin.on("error", () => {});
    child.on("error", () => finish("Could not start Codex. Check its executable path."));
    child.on("close", () => {
      clearTimeout(killTimer);
      finish("Codex could not list models. Check login and CLI version in your terminal.");
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (done) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > 1000000) return finish("Codex model list exceeded the size limit.");
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (done) break;
        let event: Record<string, unknown>;
        try {
          event = object(JSON.parse(line));
        } catch {
          continue;
        }
        if (event.id !== 1 && event.id !== requestId) continue;
        if (event.error) return finish(agentErrorMessage(event.error));
        if (event.id === 1) {
          send({ method: "initialized" });
          send({
            id: requestId,
            method: "model/list",
            params: { limit: 100, includeHidden: false },
          });
          continue;
        }
        const page = PageSchema.safeParse(event.result);
        if (!page.success) return finish("Codex returned an invalid model list. Update the CLI.");
        for (const entry of page.data.data) {
          const model = ModelSchema.safeParse(entry);
          if (!model.success || model.data.hidden) continue;
          models.set(model.data.model, {
            id: model.data.model,
            displayName: model.data.displayName,
            isDefault: model.data.isDefault,
            reasoningEfforts: model.data.supportedReasoningEfforts.flatMap((entry) => {
              const effort = CodexReasoningEffortSchema.safeParse(entry.reasoningEffort);
              return effort.success ? [effort.data] : [];
            }),
          });
        }
        const cursor = page.data.nextCursor;
        if (!cursor) return finish();
        if (cursors.has(cursor) || cursors.size >= 10)
          return finish("Codex returned an invalid model list cursor.");
        cursors.add(cursor);
        send({
          id: ++requestId,
          method: "model/list",
          params: { cursor, limit: 100, includeHidden: false },
        });
      }
    });
    send({
      id: 1,
      method: "initialize",
      params: { clientInfo: { name: "structsmith", title: "StructSmith", version: "1" } },
    });
  });
}
