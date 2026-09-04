import { expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";
import config from "../.releaserc.json" with { type: "json" };
import { isReleaseVersion, versionFromTags } from "../scripts/release-version.ts";

const logger = { log() {} };

test("release notes include runtime dependency updates", async () => {
  const notes = await generateNotes(config.plugins[1][1], {
    cwd: process.cwd(),
    env: process.env,
    logger,
    options: { repositoryUrl: "https://github.com/dziksu/StructSmith.git" },
    branch: { name: "main" },
    lastRelease: { gitTag: "v1.0.0" },
    nextRelease: { gitTag: "v1.0.1", version: "1.0.1" },
    commits: [{ hash: "a".repeat(40), message: "build(deps): upgrade Drizzle" }],
  });
  expect(notes).toContain("Build and Dependencies");
  expect(notes).toContain("upgrade Drizzle");
});
for (const [message, expected] of [
  ["fix: repair import", "patch"],
  ["feat: add a view", "minor"],
  ["perf: speed up layout", "patch"],
  ["feat!: change the API", "major"],
  ["fix: change API\n\nBREAKING CHANGE: old API removed", "major"],
  ["build(deps): upgrade Drizzle", "patch"],
  ["build(deps)!: drop old database support", "major"],
  ["build(deps-dev): upgrade formatter", null],
  ["docs: update README", null],
  ["chore: tidy configuration", null],
]) {
  test(`release rule: ${message.split("\n")[0]}`, async () => {
    expect(
      await analyzeCommits(config.plugins[0][1], {
        cwd: process.cwd(),
        env: process.env,
        logger,
        commits: [{ hash: "1234567", message }],
      }),
    ).toBe(expected);
  });
}

test("release retries only reuse a stable tag on the same commit", () => {
  expect(versionFromTags("v1.2.3\nother-tag\n")).toBe("1.2.3");
  expect(versionFromTags("v1.2.3-beta.1")).toBe("");
  expect(versionFromTags("")).toBe("");
  expect(() => versionFromTags("v1.2.3\nv1.2.4")).toThrow();
  expect(isReleaseVersion("1.2.3\nversion=bad")).toBe(false);
});

test("build version stamping validates input and changes only the version", () => {
  const directory = mkdtempSync(join(tmpdir(), "structsmith-version-"));
  try {
    mkdirSync(join(directory, "scripts"));
    for (const file of ["set-build-version.ts", "release-version.ts"]) {
      copyFileSync(
        new URL(`../scripts/${file}`, import.meta.url),
        join(directory, "scripts", file),
      );
    }
    const manifest = join(directory, "package.json");
    writeFileSync(manifest, JSON.stringify({ name: "test", version: "0.1.0", private: true }));
    const script = join(directory, "scripts", "set-build-version.ts");
    expect(spawnSync(process.execPath, [script, "bad-version"]).status).not.toBe(0);
    expect(JSON.parse(readFileSync(manifest, "utf8")).version).toBe("0.1.0");
    execFileSync(process.execPath, [script, "1.2.3"]);
    expect(JSON.parse(readFileSync(manifest, "utf8"))).toEqual({
      name: "test",
      version: "1.2.3",
      private: true,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("release publishing refuses to run outside main GitHub Actions", () => {
  const result = spawnSync(process.execPath, ["scripts/release.ts"], {
    env: { ...process.env, GITHUB_ACTIONS: "false", GITHUB_TOKEN: "", GH_TOKEN: "" },
    encoding: "utf8",
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Releases must run in GitHub Actions on main");
});
