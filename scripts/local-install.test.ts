import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("the no-clone installer verifies a release binary before executing it and forwards options", async () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-install-test-"));
  const installed = join(directory, "installed");
  const capture = join(directory, "arguments.txt");
  const artifact = `structsmith-local-${process.platform}-${process.arch}`;
  const executable = '#!/bin/sh\nprintf "%s\\n" "$@" > "$LOCAL_INSTALL_CAPTURE"\n';
  const fixture = join(directory, artifact);
  writeFileSync(fixture, executable);
  writeFileSync(
    join(directory, "SHA256SUMS"),
    `${createHash("sha256").update(executable).digest("hex")}  ${artifact}\n`,
  );
  // Only HTTP downloads are stubbed. The actual POSIX installer, checksum and install steps run.
  const curl = join(directory, "curl");
  writeFileSync(
    curl,
    `#!${process.execPath}\nimport {copyFileSync} from 'node:fs';\nimport {join} from 'node:path';\ncopyFileSync(join(process.env.LOCAL_INSTALL_FIXTURES,new URL(process.argv[3]).pathname.split('/').at(-1)),process.argv[5]);\n`,
  );
  writeFileSync(join(directory, "docker"), "#!/bin/sh\nexit 0\n");
  chmodSync(curl, 0o700);
  chmodSync(join(directory, "docker"), 0o700);
  const installer = resolve("scripts/local-install.sh");
  const run = async (installDirectory: string) => {
    const child = Bun.spawn(["sh", installer, "--port", "59090", "--no-open"], {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        STRUCTSMITH_VERSION: "1.12.0",
        STRUCTSMITH_LOCAL_DIR: installDirectory,
        LOCAL_INSTALL_FIXTURES: directory,
        LOCAL_INSTALL_CAPTURE: capture,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, error] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    return { code, error };
  };
  try {
    expect(await run(installed)).toMatchObject({ code: 0 });
    expect(readFileSync(capture, "utf8")).toBe("--port\n59090\n--no-open\n");
    expect(readFileSync(join(installed, "structsmith-local"), "utf8")).toBe(executable);
    rmSync(capture);
    writeFileSync(join(directory, "SHA256SUMS"), `${"0".repeat(64)}  ${artifact}\n`);
    const rejectedDirectory = join(directory, "rejected");
    expect(await run(rejectedDirectory)).toMatchObject({
      code: 1,
      error: expect.stringContaining("checksum does not match"),
    });
    expect(existsSync(rejectedDirectory)).toBe(false);
    expect(existsSync(capture)).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
