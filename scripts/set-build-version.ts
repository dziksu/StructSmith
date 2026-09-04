import { readFileSync, writeFileSync } from "node:fs";
import { isReleaseVersion } from "./release-version.ts";

const version = process.argv[2];
if (!version || !isReleaseVersion(version))
  throw new Error("A stable release version is required.");
const file = new URL("../package.json", import.meta.url);
const manifest = JSON.parse(readFileSync(file, "utf8"));
manifest.version = version;
writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
