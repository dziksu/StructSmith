import { randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PRODUCT } from "@structsmith/contracts";
import { z } from "zod";
import { createLocalApp } from "./app";

const OWNER_LABEL = "org.structsmith.local-helper";
const INSTANCE_LABEL = "org.structsmith.local-instance";
const StateSchema = z.object({
  token: z.string().min(32),
  container: z.string(),
  containerId: z.string(),
  image: z.string(),
  port: z.number().int().positive(),
  backendPort: z.number().int().positive(),
});
type State = z.infer<typeof StateSchema>;
const ContainerSchema = z.object({
  id: z.string(),
  labels: z.record(z.string(), z.string()).nullable(),
});

export interface LocalOptions {
  command: "start" | "stop" | "status";
  port: number;
  backendPort: number;
  image: string;
  container: string;
  volume: string;
  dataDirectory: string;
  open: boolean;
  readOnly: boolean;
}

export function parseLocalOptions(args: string[]): LocalOptions {
  const options: LocalOptions = {
    command: "start",
    port: 8090,
    backendPort: 8091,
    image: `ghcr.io/dziksu/structsmith:v${PRODUCT.version}`,
    container: "structsmith-local",
    volume: "structsmith-data",
    dataDirectory: join(homedir(), ".local", "share", "structsmith"),
    open: true,
    readOnly: false,
  };
  let explicitBackendPort = false;
  const values = [...args];
  if (["start", "stop", "status"].includes(values[0] ?? ""))
    options.command = values.shift() as LocalOptions["command"];
  while (values.length) {
    const flag = values.shift();
    if (flag === "--no-open") options.open = false;
    else if (flag === "--read-only") options.readOnly = true;
    else {
      const value = values.shift();
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}.`);
      if (flag === "--port") options.port = Number(value);
      else if (flag === "--backend-port") {
        explicitBackendPort = true;
        options.backendPort = Number(value);
      } else if (flag === "--image") options.image = value;
      else if (flag === "--container") options.container = value;
      else if (flag === "--volume") options.volume = value;
      else if (flag === "--data-dir") options.dataDirectory = resolve(value);
      else throw new Error(`Unknown option ${flag}.`);
    }
  }
  if (!explicitBackendPort) options.backendPort = options.port + 1;
  for (const port of [options.port, options.backendPort])
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("Ports must be integers between 1 and 65535.");
  if (options.port === options.backendPort) throw new Error("Use different UI and backend ports.");
  for (const name of [options.container, options.volume])
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name))
      throw new Error("Container and volume names must be Docker names, not paths or options.");
  if (!options.image || /\s/.test(options.image) || options.image.startsWith("-"))
    throw new Error("Choose a valid Docker image reference.");
  return options;
}

async function docker(args: string[], token?: string): Promise<string> {
  if (!Bun.which("docker")) throw new Error("Install and start Docker before running StructSmith.");
  const child = Bun.spawn(["docker", ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...(token ? { APP_TOKEN: token } : {}) },
  });
  const [output, error, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`Docker: ${error.trim().slice(-2000) || "command failed"}`);
  return output.trim();
}

async function inspectContainer(name: string) {
  try {
    const output = await docker([
      "container",
      "inspect",
      "--format",
      '{"id":{{json .Id}},"labels":{{json .Config.Labels}}}',
      name,
    ]);
    return ContainerSchema.parse(JSON.parse(output));
  } catch (error) {
    if (error instanceof Error && /No such (object|container)/i.test(error.message)) return null;
    throw error;
  }
}

function privateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32" && (statSync(path).mode & 0o077) !== 0)
    throw new Error(`Use a private directory (mode 0700) for local settings: ${path}`);
}

function readState(path: string): State | null {
  return existsSync(path) ? StateSchema.parse(JSON.parse(readFileSync(path, "utf8"))) : null;
}

function writeState(path: string, state: State): void {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
  renameSync(temporary, path);
}

function lockProfile(directory: string): () => void {
  const file = join(directory, "local.lock");
  const nonce = randomUUID();
  if (existsSync(file)) {
    const previous = z
      .object({ pid: z.number().int(), nonce: z.string() })
      .parse(JSON.parse(readFileSync(file, "utf8")));
    try {
      process.kill(previous.pid, 0);
      throw new Error("This local profile is already running. Use status or stop first.");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
      unlinkSync(file);
    }
  }
  const descriptor = openSync(file, "wx", 0o600);
  writeFileSync(descriptor, JSON.stringify({ pid: process.pid, nonce }));
  closeSync(descriptor);
  return () => {
    if (existsSync(file) && JSON.parse(readFileSync(file, "utf8")).nonce === nonce)
      unlinkSync(file);
  };
}

async function assertFreePort(port: number): Promise<void> {
  const server = createServer();
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", () =>
      reject(new Error(`Local port ${port} is occupied. Choose another port.`)),
    );
    server.listen(port, "127.0.0.1", () => server.close(() => resolvePromise()));
  });
}

async function waitForBackend(url: URL, token: string, signal: AbortSignal): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    signal.throwIfAborted();
    try {
      const response = await fetch(new URL("/health", url), {
        signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
      });
      if (response.ok) {
        const body = z.object({ version: z.string() }).parse(await response.json());
        if (body.version !== PRODUCT.version)
          throw new Error(
            `Helper ${PRODUCT.version} requires the matching Docker image, got ${body.version}.`,
          );
        const authenticated = await fetch(new URL("/api/settings", url), {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
        });
        if (authenticated.ok) return;
        throw new Error("Docker authentication does not match the local profile.");
      }
    } catch (error) {
      if (
        error instanceof Error &&
        /requires the matching|authentication does not match/.test(error.message)
      )
        throw error;
    }
    await Bun.sleep(500);
  }
  throw new Error("Docker did not become healthy. Check its logs and try again.");
}

async function removeOwnedContainer(name: string, expectedId: string): Promise<void> {
  const existing = await inspectContainer(name);
  if (!existing) return;
  if (existing.id !== expectedId || existing.labels?.[OWNER_LABEL] !== "true")
    throw new Error(`Refusing to remove an unrelated container named ${name}.`);
  // The named data volume is intentionally retained.
  await docker(["container", "rm", "--force", name]);
}

async function control(state: State, action: "status" | "stop"): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${state.port}/__structsmith_local/${action}`, {
      method: action === "stop" ? "POST" : "GET",
      headers: { Authorization: `Bearer ${state.token}` },
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function runLocal(options: LocalOptions): Promise<void> {
  const statePath = join(options.dataDirectory, "local.json");
  if (options.command !== "start") {
    const state = readState(statePath);
    const running = state && (await control(state, options.command));
    if (!running && state && options.command === "stop") {
      await removeOwnedContainer(state.container, state.containerId);
      unlinkSync(statePath);
    }
    console.log(
      running
        ? options.command === "stop"
          ? "Stopping StructSmith."
          : `StructSmith is running at http://localhost:${state.port}.`
        : "StructSmith local is not running.",
    );
    return;
  }

  privateDirectory(options.dataDirectory);
  const unlock = lockProfile(options.dataDirectory);
  let ownedId: string | undefined;
  const instance = randomUUID();
  let runAttempted = false;
  let cleanupApp: (() => Promise<void>) | undefined;
  const controller = new AbortController();
  let finish: () => void = () => undefined;
  const stopped = new Promise<void>((resolvePromise) => {
    finish = resolvePromise;
  });
  const stop = () => {
    controller.abort();
    finish();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    await assertFreePort(options.port);
    await assertFreePort(options.backendPort);
    const previous = readState(statePath);
    const existing = await inspectContainer(options.container);
    if (existing) {
      if (
        !previous ||
        previous.containerId !== existing.id ||
        existing.labels?.[OWNER_LABEL] !== "true"
      )
        throw new Error(
          `Container ${options.container} is not owned by this profile. Choose another name.`,
        );
      await removeOwnedContainer(options.container, existing.id);
    }
    const activeVolumeUsers = await docker([
      "ps",
      "--filter",
      `volume=${options.volume}`,
      "--format",
      "{{.Names}}",
    ]);
    if (activeVolumeUsers)
      throw new Error(
        `Data volume ${options.volume} is already used by ${activeVolumeUsers}. Stop that deployment or choose another volume.`,
      );
    controller.signal.throwIfAborted();
    const token = randomBytes(32).toString("hex");
    console.log(`Starting ${options.image}. Local agents run on this computer.`);
    runAttempted = true;
    ownedId = await docker(
      [
        "run",
        "--detach",
        "--name",
        options.container,
        "--label",
        `${OWNER_LABEL}=true`,
        "--label",
        `${INSTANCE_LABEL}=${instance}`,
        "--publish",
        `127.0.0.1:${options.backendPort}:8080`,
        "--volume",
        `${options.volume}:/data`,
        "--env",
        "AUTH_MODE=token",
        "--env",
        "APP_TOKEN",
        "--env",
        "AGENT_CHAT_ENABLED=false",
        "--env",
        "AGENT_CHAT_DIR=/data/agent-chat",
        "--env",
        `MCP_READ_ONLY=${options.readOnly}`,
        options.image,
      ],
      token,
    );
    const state: State = {
      token,
      container: options.container,
      containerId: ownedId,
      image: options.image,
      port: options.port,
      backendPort: options.backendPort,
    };
    writeState(statePath, state);
    const backendUrl = new URL(`http://127.0.0.1:${options.backendPort}`);
    await waitForBackend(backendUrl, token, controller.signal);
    const handle = await createLocalApp({
      backendUrl,
      token,
      port: options.port,
      chatDirectory: join(options.dataDirectory, "chat"),
      onStop: () => finish(),
    });
    const server = handle.app.listen(options.port, "127.0.0.1");
    cleanupApp = async () => {
      try {
        await handle.close();
      } finally {
        const closed = new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
        server.closeAllConnections();
        await closed;
      }
    };
    await new Promise<void>((resolvePromise, reject) => {
      server.once("listening", resolvePromise);
      server.once("error", reject);
    });
    controller.signal.throwIfAborted();
    const address = `http://localhost:${options.port}`;
    console.log(
      `\nStructSmith ${PRODUCT.version}: ${address}\nChat history: ${join(options.dataDirectory, "chat")}\nPress Ctrl+C to stop. The Docker data volume is retained.`,
    );
    if (options.open) {
      const opener = process.platform === "darwin" ? "open" : "xdg-open";
      if (Bun.which(opener)) {
        const child = Bun.spawn([opener, address], { stdout: "ignore", stderr: "ignore" });
        void child.exited;
      }
    }
    await stopped;
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    try {
      try {
        await cleanupApp?.();
      } finally {
        if (!ownedId && runAttempted) {
          const leftover = await inspectContainer(options.container);
          if (
            leftover?.labels?.[INSTANCE_LABEL] === instance &&
            leftover.labels[OWNER_LABEL] === "true"
          )
            ownedId = leftover.id;
        }
        if (ownedId) await removeOwnedContainer(options.container, ownedId);
        if (ownedId && existsSync(statePath) && readState(statePath)?.containerId === ownedId)
          unlinkSync(statePath);
      }
    } finally {
      unlock();
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    }
  }
}

export const localHelp = `StructSmith local ${PRODUCT.version}

Usage: structsmith-local [start|stop|status] [options]

  --port NUMBER          UI and host chat port (8090)
  --backend-port NUMBER  Private Docker port (UI port + 1)
  --volume NAME          Docker model volume (structsmith-data)
  --container NAME       Managed container name (structsmith-local)
  --data-dir PATH        Private host state and chat directory
  --image IMAGE          Matching image (ghcr.io/dziksu/structsmith:v${PRODUCT.version})
  --read-only            Disable architecture writes
  --no-open              Do not open the browser

Docker and signed-in agent CLIs must already be installed. No repository or Bun
installation is needed for the released executable. Ctrl+C stops this profile.
`;
