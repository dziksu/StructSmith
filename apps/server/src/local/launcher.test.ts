import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseLocalOptions, runLocal } from "./launcher";

test("launcher refuses foreign containers/shared volumes and cleans up its failed Docker run", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-launcher-test-"));
  const executable = join(directory, "docker");
  const calls = join(directory, "calls.jsonl");
  const created = join(directory, "created.json");
  writeFileSync(
    executable,
    `#!${process.execPath}
import {appendFileSync,existsSync,readFileSync,unlinkSync,writeFileSync} from 'node:fs';
const args=process.argv.slice(2);
appendFileSync(${JSON.stringify(calls)},JSON.stringify(args)+'\\n');
const mode=process.env.LOCAL_LAUNCH_SCENARIO;
const created=${JSON.stringify(created)};
if(args[0]==='container' && args[1]==='inspect') {
  if(mode==='foreign') console.log(JSON.stringify({id:'foreign-id',labels:{'org.structsmith.local-helper':'true'}}));
  else if(existsSync(created)) console.log(readFileSync(created,'utf8'));
  else { console.error('No such container'); process.exit(1); }
} else if(args[0]==='ps') {
  if(mode==='volume') console.log('another-model-server');
} else if(args[0]==='run') {
  const labels=Object.fromEntries(args.flatMap((arg,i)=>arg==='--label'?[args[i+1].split('=')]:[]));
  writeFileSync(created,JSON.stringify({id:'test-created-id',labels}));
  console.error('port is already allocated'); process.exit(1);
} else if(args[0]==='container' && args[1]==='rm') {
  unlinkSync(created); console.log('test-created-id');
} else process.exit(1);
`,
  );
  chmodSync(executable, 0o700);
  const previousPath = process.env.PATH;
  const previousScenario = process.env.LOCAL_LAUNCH_SCENARIO;
  process.env.PATH = `${directory}:${previousPath}`;
  try {
    for (const [scenario, message] of [
      ["foreign", "not owned"],
      ["volume", "already used"],
      ["failed", "port is already allocated"],
    ]) {
      process.env.LOCAL_LAUNCH_SCENARIO = scenario;
      writeFileSync(calls, "");
      const profile = join(directory, scenario ?? "");
      const options = parseLocalOptions(["--port", "59094", "--data-dir", profile, "--no-open"]);
      await expect(runLocal(options)).rejects.toThrow(message);
      const recorded: string[][] = readFileSync(calls, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      if (scenario === "failed") {
        expect(recorded.some((args) => args[0] === "container" && args[1] === "rm")).toBe(true);
        expect(existsSync(created)).toBe(false);
      } else expect(recorded.some((args) => args[0] === "run" || args[1] === "rm")).toBe(false);
      expect(recorded.some((args) => args[0] === "volume" && args[1] === "rm")).toBe(false);
      expect(existsSync(join(profile, "local.lock"))).toBe(false);
    }
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousScenario === undefined) delete process.env.LOCAL_LAUNCH_SCENARIO;
    else process.env.LOCAL_LAUNCH_SCENARIO = previousScenario;
    rmSync(directory, { recursive: true, force: true });
  }
});
