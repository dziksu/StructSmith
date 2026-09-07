import { readdir } from "node:fs/promises";

const outputDirectory = new URL("../dist/", import.meta.url);
const html = await Bun.file(new URL("index.html", outputDirectory)).text();
const outputFiles = await readdir(outputDirectory, { recursive: true });

const runtimeBundles = outputFiles.filter((path) => /\.(?:css|js|mjs|cjs)$/i.test(path));
const failures = [
  [!html.includes("Architecture that stays useful"), "rendered page content is missing"],
  [html.includes("<!--STRUCTSMITH_STATIC_HTML-->"), "HTML placeholder was not replaced"],
  [/<script\b[^>]*\bsrc=/i.test(html), "a runtime script is still referenced"],
  [/<link\b[^>]*\brel=["']stylesheet["']/i.test(html), "an external stylesheet is referenced"],
  [runtimeBundles.length > 0, `runtime bundles were emitted: ${runtimeBundles.join(", ")}`],
] as const;

const failed = failures.filter(([condition]) => condition).map(([, message]) => message);

if (failed.length > 0) {
  throw new Error(`Static site verification failed: ${failed.join("; ")}`);
}

console.log("Verified: complete HTML, inline CSS, and no client runtime bundles.");
