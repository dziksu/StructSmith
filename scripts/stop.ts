/**
 * Stops whatever is still listening on the development ports.
 *
 * Killing the dev wrapper is not always enough: `bun run dev` starts Vite as a
 * grandchild process, so a SIGTERM to the wrapper can leave Vite holding :5173.
 * Working by port instead of by PID reliably frees both.
 *
 * Usage: `bun run stop` or `bun run stop 3500 4000`
 */

export function pidsOnPort(port: number): number[] {
  const result = Bun.spawnSync(["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  return new TextDecoder()
    .decode(result.stdout)
    .split("\n")
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** SIGTERM first, SIGKILL for anything that ignores it. */
export async function stopPorts(ports: readonly number[]): Promise<Map<number, number[]>> {
  const stopped = new Map<number, number[]>();

  for (const port of ports) {
    const pids = pidsOnPort(port);
    if (pids.length === 0) continue;

    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
    stopped.set(port, pids);
  }

  if (stopped.size === 0) return stopped;

  await Bun.sleep(400);

  for (const pids of stopped.values()) {
    for (const pid of pids) {
      if (!isAlive(pid)) continue;
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }

  return stopped;
}

export const defaultDevPorts = (): number[] => [
  Number(process.env.PORT ?? 3000),
  Number(process.env.WEB_PORT ?? 5173),
];

if (import.meta.main) {
  if (process.platform === "win32") {
    console.error("[stop] not supported on Windows — stop the processes from Task Manager.");
    process.exit(1);
  }

  const requested = process.argv
    .slice(2)
    .map((value) => Number.parseInt(value, 10))
    .filter((port) => Number.isInteger(port) && port > 0);

  const ports = requested.length > 0 ? requested : defaultDevPorts();
  const stopped = await stopPorts(ports);

  if (stopped.size === 0) {
    console.log(`[stop] nothing listening on ${ports.join(", ")}`);
  } else {
    for (const [port, pids] of stopped) {
      console.log(`[stop] port ${port}: stopped ${pids.join(", ")}`);
    }
  }
}
