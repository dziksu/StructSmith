import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import semanticRelease from "semantic-release";
import { isReleaseVersion, versionFromTags } from "./release-version.ts";

// Never publish from a developer shell or a pull request.
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.GITHUB_REF !== "refs/heads/main" ||
  !["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")
) {
  throw new Error("Releases must run in GitHub Actions on main after CI succeeds.");
}
if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required.");

const result = await semanticRelease({});
// A rerun after an image-publication failure must still publish the existing tag.
const version = result
  ? result.nextRelease.version
  : versionFromTags(
      execFileSync("git", ["tag", "--points-at", "HEAD", "--list", "v*"], { encoding: "utf8" }),
    );
if (version && !isReleaseVersion(version)) throw new Error("Invalid release version.");
appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
