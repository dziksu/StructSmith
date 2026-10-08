import { expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";
import config from "../.releaserc.json" with { type: "json" };
import { isReleaseVersion, versionFromTags } from "../scripts/release-version.ts";

const logger = { log() {} };

test("release writes the changelog before publishing to GitHub", () => {
  const pluginNames = config.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
  expect(pluginNames).toEqual([
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/github",
  ]);
});

test("release syncs changelog and package version through one auto-merged pull request", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  const stamp = `bun scripts/set-build-version.ts "\${{ steps.release.outputs.version }}"`;
  expect(workflow).toContain("id: changelog-pr");
  expect(workflow).toContain("steps.changelog-pr.outputs.pull-request-number != ''");
  expect(workflow).toContain("Wait for release metadata verification");
  expect(workflow).toContain('select(.name == "Lint, types, tests, build")');
  expect(workflow.indexOf("Wait for release metadata verification")).toBeLessThan(
    workflow.indexOf("Merge release metadata pull request"),
  );
  expect(workflow).toContain('if [ "$merge_state" = "CLEAN" ]; then');
  expect(workflow).toContain('gh pr merge --squash "$RELEASE_PR_NUMBER"');
  expect(workflow).toContain('gh pr merge --squash --auto "$RELEASE_PR_NUMBER"');
  expect(workflow).toContain("GH_TOKEN:");
  expect(workflow).toContain("secrets.RELEASE_PR_TOKEN");
  expect(workflow).toContain(stamp);
  expect(workflow).toContain("add-paths: |\n            CHANGELOG.md\n            package.json");
  expect(workflow.indexOf(stamp)).toBeLessThan(workflow.indexOf("id: changelog-pr"));
});

test("Docker cache export cannot block CI or image publication", () => {
  const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const imageWorkflow = readFileSync(
    new URL("../.github/workflows/docker.yml", import.meta.url),
    "utf8",
  );

  expect(ciWorkflow).toContain("cache-to: type=gha,mode=min,scope=ci,ignore-error=true,timeout=2m");
  expect(ciWorkflow).toContain(
    "github.event_name != 'pull_request' || !startsWith(github.head_ref, 'automation/changelog-v')",
  );
  expect(imageWorkflow).toContain(
    "cache-to: type=gha,mode=max,scope=release-image,ignore-error=true,timeout=2m",
  );
});

test("a metadata PR failure cannot strand an existing release without its image and installer", () => {
  const { jobs } = Bun.YAML.parse(
    readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
  );
  // GitHub implicitly requires successful dependencies unless an explicit
  // status function is present. Exercise the actual workflow expressions.
  const runs = (job, needs, cancelled = false) => {
    const condition = job.if.replace(/^\$\{\{\s*|\s*\}\}$/g, "");
    const hasStatusCheck = /\b(?:success|failure|always|cancelled)\(/.test(condition);
    const dependencies = Array.isArray(job.needs) ? job.needs : [job.needs];
    const implicitSuccess = dependencies.every((name) => needs[name].result === "success");
    return (
      (hasStatusCheck || implicitSuccess) &&
      runInNewContext(condition, { needs, cancelled: () => cancelled })
    );
  };
  const released = { result: "failure", outputs: { version: "1.14.0" } };
  expect(runs(jobs.publish, { release: released })).toBe(true);
  expect(runs(jobs["local-helper"], { release: released, publish: { result: "success" } })).toBe(
    true,
  );
  for (const result of ["failure", "skipped", "cancelled"]) {
    expect(runs(jobs["local-helper"], { release: released, publish: { result } })).toBe(false);
  }
  for (const result of ["success", "failure", "skipped"]) {
    const noRelease = { result, outputs: { version: "" } };
    expect(runs(jobs.publish, { release: noRelease })).toBe(false);
    expect(runs(jobs["local-helper"], { release: noRelease, publish: { result: "success" } })).toBe(
      false,
    );
  }
  expect(runs(jobs.publish, { release: released }, true)).toBe(false);
  expect(
    runs(jobs["local-helper"], { release: released, publish: { result: "success" } }, true),
  ).toBe(false);
  expect(jobs.release.needs).toEqual(["verify", "docker"]);
});

test("source package version matches the newest changelog release", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const newestRelease = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];

  expect(newestRelease).toBeDefined();
  expect(manifest.version).toBe(newestRelease);
});

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
