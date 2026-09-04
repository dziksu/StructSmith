/**
 * One command starts both processes (spec §6): the Bun API on :3000 and the
 * Vite dev server on :5173, which proxies /api and /mcp to the backend.
 */
import { defaultDevPorts, stopPorts } from "./stop";

const processes = [
  Bun.spawn(["bun", "--watch", "apps/server/src/index.ts"], {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env, PORT: process.env.PORT ?? "3000" },
  }),
  Bun.spawn(["bun", "run", "dev"], {
    cwd: "apps/web",
    stdio: ["inherit", "inherit", "inherit"],
    env: process.env,
  }),
];

let stopping = false;

/**
 * Vite runs as a grandchild, so killing our direct children can leave it
 * holding the port — free the ports explicitly as well.
 */
const stop = async (): Promise<void> => {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill();
  await stopPorts(defaultDevPorts());
};

process.on("SIGINT", () => void stop().then(() => process.exit(0)));
process.on("SIGTERM", () => void stop().then(() => process.exit(0)));

// If either process dies (a crash, or an external kill), take the other down
// too, so the next `bun run dev` starts from a clean slate.
await Promise.race(processes.map((child) => child.exited));
await stop();
