import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const userMessage = (text: string) => ({
  messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
});

const workspaceArgs = { workspaceId: z.string().describe("Workspace id to work on.") };

/**
 * Prompt templates only — they never call an LLM themselves (spec §24).
 */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "review_architecture",
    {
      title: "Review architecture",
      description: "Review the architecture of a workspace.",
      argsSchema: workspaceArgs,
    },
    ({ workspaceId }) =>
      userMessage(
        [
          `Read the model of workspace "${workspaceId}" via the \`model_get\` tool (format: "outline") and the resource architecture://workspace/${workspaceId}/model.`,
          "",
          "Then review the architecture and report:",
          "1. What the system does, in two sentences.",
          "2. Structural problems (missing boundaries, wrong C4 levels, unclear responsibilities).",
          "3. Missing or under-specified integrations.",
          "4. Concrete improvements, ordered by impact.",
          "",
          "Also run `model_validate` and comment on the findings that actually matter.",
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "create_presales_architecture",
    {
      title: "Create presales architecture",
      description: "Draft a presales architecture from a short brief.",
      argsSchema: {
        workspaceId: z.string().describe("Target workspace id."),
        brief: z.string().describe("What the client asked for."),
      },
    },
    ({ workspaceId, brief }) =>
      userMessage(
        [
          `Design a first-pass solution architecture in workspace "${workspaceId}".`,
          "",
          "Client brief:",
          brief,
          "",
          "Rules:",
          "- Apply the whole change with a single `model_apply_operations` call.",
          "- Use `ref` aliases so relationships can point at elements created in the same batch.",
          "- Model people, systems, containers and external systems explicitly; set `technology` wherever you can.",
          "- Create a system context view and a container view, then call `view_auto_layout` for each.",
          "- Record every assumption and unknown as a presales record.",
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "identify_architecture_risks",
    {
      title: "Identify architecture risks",
      description: "List architectural risks and store them as records.",
      argsSchema: workspaceArgs,
    },
    ({ workspaceId }) =>
      userMessage(
        [
          `Analyse workspace "${workspaceId}" and identify architectural risks.`,
          "For each risk: what could go wrong, what it affects, how likely and how severe.",
          'Store the important ones with `record_create` (kind: "risk") and link them to the affected elements.',
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "identify_unknowns",
    {
      title: "Identify unknowns",
      description: "Find the open questions worth asking on a discovery call.",
      argsSchema: workspaceArgs,
    },
    ({ workspaceId }) =>
      userMessage(
        [
          `Read workspace "${workspaceId}" and list everything that is still unknown:`,
          "protocols, volumes, SLAs, data ownership, auth, environments, migration.",
          'Group the findings into questions for a discovery call and store them with `record_create` (kind: "unknown").',
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "review_security",
    {
      title: "Review security",
      description: "Review the architecture from a security angle.",
      argsSchema: workspaceArgs,
    },
    ({ workspaceId }) =>
      userMessage(
        [
          `Review workspace "${workspaceId}" from a security perspective:`,
          "trust boundaries, authentication and authorisation, secrets, data at rest and in transit,",
          "third-party exposure, and any person talking straight to a datastore.",
          "Report findings by severity and suggest concrete model changes.",
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "review_scalability",
    {
      title: "Review scalability",
      description: "Review the architecture for scalability.",
      argsSchema: workspaceArgs,
    },
    ({ workspaceId }) =>
      userMessage(
        [
          `Review workspace "${workspaceId}" for scalability:`,
          "synchronous chains that should be asynchronous, single points of failure,",
          "stateful components, caching opportunities and datastore hotspots.",
          "Where a change is clearly right, propose it as a `model_apply_operations` batch.",
        ].join("\n"),
      ),
  );
}
