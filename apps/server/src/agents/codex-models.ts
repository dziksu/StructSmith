import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type CodexModel, CodexReasoningEffortSchema } from "@structsmith/contracts";
import { z } from "zod";

const CacheSchema = z.object({ models: z.array(z.unknown()) });
const ModelSchema = z.object({
  slug: z.string().min(1),
  supported_reasoning_levels: z.array(z.object({ effort: z.string() })),
});

/** Read only model capabilities; no credentials or CLI inference are needed. */
export function readCodexModels(
  file = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "models_cache.json"),
): CodexModel[] {
  try {
    const cache = CacheSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    return cache.models.flatMap((entry) => {
      const model = ModelSchema.safeParse(entry);
      if (!model.success) return [];
      const reasoningEfforts = model.data.supported_reasoning_levels.flatMap(({ effort }) => {
        const result = CodexReasoningEffortSchema.safeParse(effort);
        return result.success ? [result.data] : [];
      });
      return reasoningEfforts.length ? [{ id: model.data.slug, reasoningEfforts }] : [];
    });
  } catch {
    // A fresh CLI installation may not have a catalog yet. Settings still work.
    return [];
  }
}
