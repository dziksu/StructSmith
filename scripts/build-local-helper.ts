import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PRODUCT } from "@structsmith/contracts";

const targets = [
  { platform: "darwin", arch: "arm64", target: "bun-darwin-arm64" },
  { platform: "darwin", arch: "x64", target: "bun-darwin-x64" },
  { platform: "linux", arch: "arm64", target: "bun-linux-arm64" },
  { platform: "linux", arch: "x64", target: "bun-linux-x64-baseline" },
] as const;
const selected = process.argv.includes("--all")
  ? targets
  : targets.filter(({ platform, arch }) => platform === process.platform && arch === process.arch);
if (!selected.length) throw new Error("Build on macOS/Linux arm64/x64, or use --all.");
const output = resolve("dist/local-helper");
mkdirSync(output, { recursive: true });
const checksums: string[] = [];
for (const { platform, arch, target } of selected) {
  const name = `structsmith-local-${platform}-${arch}`;
  const outfile = join(output, name);
  await Bun.build({
    entrypoints: ["apps/server/src/local/index.ts"],
    compile: { target, outfile },
    minify: true,
  });
  chmodSync(outfile, 0o755);
  checksums.push(`${createHash("sha256").update(readFileSync(outfile)).digest("hex")}  ${name}`);
  console.log(`Built ${name} (${PRODUCT.version}).`);
}
writeFileSync(join(output, "SHA256SUMS"), `${checksums.join("\n")}\n`);
writeFileSync(
  join(output, "structsmith-local-install.sh"),
  readFileSync("scripts/local-install.sh", "utf8").replaceAll(
    "__STRUCTSMITH_VERSION__",
    PRODUCT.version,
  ),
  { mode: 0o755 },
);
