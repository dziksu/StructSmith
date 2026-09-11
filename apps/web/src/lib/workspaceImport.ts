import { WorkspaceDocumentSchema } from "@structsmith/contracts";

/** Decide before making a request, so a failed JSON request never retries as Mermaid. */
export function parseWorkspaceImport(fileName: string, content: string) {
  const source = content.trim();
  const explicitMermaid = /\.(?:mmd|mermaid)$/i.test(fileName);
  const isJson = /\.json$/i.test(fileName) || /^[{[]/.test(source);
  if (!explicitMermaid && isJson) {
    return { kind: "json" as const, document: WorkspaceDocumentSchema.parse(JSON.parse(source)) };
  }
  return { kind: "mermaid" as const, source };
}
